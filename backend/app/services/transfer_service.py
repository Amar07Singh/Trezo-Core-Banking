import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    AccountInactiveException,
    AccountNotFoundException,
    FraudBlockedException,
    IdempotencyConflictException,
    InsufficientFundsException,
    InvalidCurrencyException,
    SameAccountTransferException,
)
from app.core.logging import logger
from app.models.account import Account, AccountStatus
from app.models.idempotency import IdempotencyRecord
from app.models.ledger import EntryType, JournalEntry, LedgerEntry
from app.models.outbox import OutboxEvent, OutboxStatus
from app.models.transfer import Transfer, TransferStatus
from app.models.user import User
from app.services.audit_service import record_audit_log
from app.services.fraud_engine import TransferContext, default_fraud_engine


async def check_idempotency(
    db: AsyncSession,
    idempotency_key: str,
    request_hash: str,
) -> tuple[int, dict[str, Any]] | None:
    stmt = select(IdempotencyRecord).where(IdempotencyRecord.key == idempotency_key)
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if record:
        if record.request_hash != request_hash:
            raise IdempotencyConflictException(
                key=idempotency_key,
                detail="Idempotency key re-used with different request payload parameters."
            )
        return record.status_code, json.loads(record.response_body)
    return None


async def execute_transfer(
    db: AsyncSession,
    current_user: User,
    sender_account_number: str,
    receiver_account_number: str,
    amount_pence: int,
    currency: str = "GBP",
    reference: str | None = None,
    narration: str | None = None,
    idempotency_key: str | None = None,
    ip_address: str | None = None,
) -> tuple[Transfer, bool]:
    """
    Executes an ACID-safe double-entry fund transfer:
    1. Validates source and destination accounts.
    2. Runs pluggable fraud/risk engine checks.
    3. Acquires pessimistic row locks in consistent ascending UUID order to guarantee NO DEADLOCKS.
       Uses execution_options(populate_existing=True) to guarantee 100% fresh post-lock balances.
    4. Validates account status and sufficient balance.
    5. Updates balances atomically.
    6. Writes balanced double-entry JournalEntry and LedgerEntry legs.
    7. Inserts OutboxEvent for asynchronous notification processing.
    8. Writes immutable AuditLog entry.
    9. Persists Idempotency record for replay.
    """
    if sender_account_number == receiver_account_number:
        raise SameAccountTransferException()

    transfer_ref = reference or f"TRF-{uuid.uuid4().hex[:12].upper()}"
    narration_text = narration or f"Fund transfer from {sender_account_number} to {receiver_account_number}"

    # 1. Fetch account IDs and basic metadata without loading full ORM entity into identity map
    stmt_sender = select(Account.id, Account.currency, Account.status).where(Account.account_number == sender_account_number)
    sender_info = (await db.execute(stmt_sender)).one_or_none()
    if not sender_info:
        raise AccountNotFoundException(sender_account_number)
    sender_id, sender_currency, sender_status = sender_info

    stmt_receiver = select(Account.id, Account.currency, Account.status).where(Account.account_number == receiver_account_number)
    receiver_info = (await db.execute(stmt_receiver)).one_or_none()
    if not receiver_info:
        raise AccountNotFoundException(receiver_account_number)
    receiver_id, receiver_currency, receiver_status = receiver_info

    if sender_currency != currency.upper():
        raise InvalidCurrencyException(expected=sender_currency, actual=currency.upper())
    if receiver_currency != currency.upper():
        raise InvalidCurrencyException(expected=receiver_currency, actual=currency.upper())

    # 2. Evaluate Fraud / Risk Rules
    fraud_ctx = TransferContext(
        sender_account_id=sender_id,
        receiver_account_id=receiver_id,
        amount=amount_pence,
        currency=currency.upper(),
    )
    fraud_eval = await default_fraud_engine.evaluate_transfer(fraud_ctx, db)

    if fraud_eval.is_blocked:
        logger.warning(
            "transfer_blocked_by_fraud_engine",
            sender=sender_account_number,
            receiver=receiver_account_number,
            reasons=fraud_eval.reasons,
        )
        raise FraudBlockedException(reasons=fraud_eval.reasons)

    # 3. DEADLOCK-FREE LOCK ORDERING
    # Always lock in consistent ascending order of UUID: min(id1, id2), then max(id1, id2)
    id_1, id_2 = sorted([sender_id, receiver_id])

    stmt_lock_1 = (
        select(Account)
        .where(Account.id == id_1)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    acc_1 = (await db.execute(stmt_lock_1)).scalar_one()

    stmt_lock_2 = (
        select(Account)
        .where(Account.id == id_2)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    acc_2 = (await db.execute(stmt_lock_2)).scalar_one()

    sender = acc_1 if acc_1.id == sender_id else acc_2
    receiver = acc_2 if acc_2.id == receiver_id else acc_1

    # 4. Account state & balance verification
    if sender.status != AccountStatus.ACTIVE:
        raise AccountInactiveException(sender.account_number, sender.status.value)
    if receiver.status != AccountStatus.ACTIVE:
        raise AccountInactiveException(receiver.account_number, receiver.status.value)

    if sender.balance < amount_pence:
        raise InsufficientFundsException(
            account_number=sender.account_number,
            current_balance=sender.balance,
            requested_amount=amount_pence,
        )

    # 5. Balance updates
    sender_initial_balance = sender.balance
    receiver_initial_balance = receiver.balance

    sender.balance -= amount_pence
    receiver.balance += amount_pence

    # 6. Double-entry Journal & Ledger
    journal = JournalEntry(
        id=uuid.uuid4(),
        reference=transfer_ref,
        narration=narration_text,
    )
    db.add(journal)
    await db.flush()

    sender_debit_leg = LedgerEntry(
        id=uuid.uuid4(),
        journal_id=journal.id,
        account_id=sender.id,
        entry_type=EntryType.DEBIT,
        amount=amount_pence,
        balance_after=sender.balance,
    )
    receiver_credit_leg = LedgerEntry(
        id=uuid.uuid4(),
        journal_id=journal.id,
        account_id=receiver.id,
        entry_type=EntryType.CREDIT,
        amount=amount_pence,
        balance_after=receiver.balance,
    )
    db.add(sender_debit_leg)
    db.add(receiver_credit_leg)

    # 7. Transfer Record
    transfer_status = TransferStatus.FLAGGED if fraud_eval.is_flagged else TransferStatus.COMPLETED
    transfer = Transfer(
        id=uuid.uuid4(),
        sender_account_id=sender.id,
        receiver_account_id=receiver.id,
        amount=amount_pence,
        currency=currency.upper(),
        status=transfer_status,
        reference=transfer_ref,
        fraud_flags=fraud_eval.reasons if fraud_eval.is_flagged else [],
        journal_id=journal.id,
    )
    db.add(transfer)
    await db.flush()

    # 8. Transactional Outbox Event
    outbox_event = OutboxEvent(
        id=uuid.uuid4(),
        event_type="TRANSFER_COMPLETED" if transfer_status == TransferStatus.COMPLETED else "TRANSFER_FLAGGED",
        aggregate_id=str(transfer.id),
        payload={
            "transfer_id": str(transfer.id),
            "reference": transfer.reference,
            "sender_account": sender.account_number,
            "receiver_account": receiver.account_number,
            "amount": amount_pence,
            "currency": transfer.currency,
            "status": transfer.status.value,
            "fraud_flags": transfer.fraud_flags,
            "timestamp": datetime.now(UTC).isoformat(),
        },
        status=OutboxStatus.PENDING,
    )
    db.add(outbox_event)

    # 9. Append-only Audit Log
    await record_audit_log(
        db=db,
        action="TRANSFER_EXECUTED",
        resource_type="TRANSFER",
        resource_id=str(transfer.id),
        user_id=current_user.id,
        before_state={
            "sender_balance": sender_initial_balance,
            "receiver_balance": receiver_initial_balance,
        },
        after_state={
            "sender_balance": sender.balance,
            "receiver_balance": receiver.balance,
            "transfer_id": str(transfer.id),
            "status": transfer.status.value,
        },
        ip_address=ip_address,
    )

    # 10. Record Idempotency Key Replay if present
    if idempotency_key:
        resp_payload = {
            "id": str(transfer.id),
            "sender_account_id": str(transfer.sender_account_id),
            "receiver_account_id": str(transfer.receiver_account_id),
            "sender_account_number": sender.account_number,
            "receiver_account_number": receiver.account_number,
            "amount": transfer.amount,
            "currency": transfer.currency,
            "status": transfer.status.value,
            "reference": transfer.reference,
            "fraud_flags": transfer.fraud_flags,
            "journal_id": str(transfer.journal_id) if transfer.journal_id else None,
            "created_at": transfer.created_at.isoformat() if transfer.created_at else datetime.now(UTC).isoformat(),
        }
        idempotency_rec = IdempotencyRecord(
            key=idempotency_key,
            user_id=current_user.id,
            request_path="/api/v1/transfers",
            request_hash=hashlib.sha256(
                f"{sender_account_number}:{receiver_account_number}:{amount_pence}:{currency}".encode()
            ).hexdigest(),
            status_code=201,
            response_headers={"Content-Type": "application/json"},
            response_body=json.dumps(resp_payload),
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
        db.add(idempotency_rec)

    await db.commit()
    await db.refresh(transfer)

    transfer.sender_account_number = sender.account_number
    transfer.receiver_account_number = receiver.account_number

    return transfer, False
