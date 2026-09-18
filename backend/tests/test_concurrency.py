import asyncio
import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.security import get_password_hash
from app.models.account import Account, AccountStatus
from app.models.ledger import EntryType, LedgerEntry
from app.models.user import User, UserRole
from app.services.transfer_service import execute_transfer


@pytest.mark.asyncio
async def test_50_parallel_concurrent_transfers_without_deadlock(async_engine):
    """
    High-Concurrency ACID Test:
    Fires 50 simultaneous parallel cross-transfers using asyncio.gather across independent
    async database sessions:
    - 25 transfers from Account A -> Account B
    - 25 transfers from Account B -> Account A
    Asserts:
    1. Zero deadlocks or race condition errors occur.
    2. Mathematical conservation of money: Total balance before == Total balance after.
    3. Double-entry ledger exactness: Sum(Debits) == Sum(Credits).
    """
    session_factory = async_sessionmaker(bind=async_engine, expire_on_commit=False)

    # 1. Setup two pre-funded test accounts
    async with session_factory() as setup_session:
        user_a = User(
            id=uuid.uuid4(),
            email=f"conc_a_{uuid.uuid4().hex[:6]}@bank.com",
            hashed_password=get_password_hash("Pass123!"),
            full_name="Concurrency User A",
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        user_b = User(
            id=uuid.uuid4(),
            email=f"conc_b_{uuid.uuid4().hex[:6]}@bank.com",
            hashed_password=get_password_hash("Pass123!"),
            full_name="Concurrency User B",
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        setup_session.add_all([user_a, user_b])
        await setup_session.flush()

        initial_balance_a = 500000  # £5,000.00
        initial_balance_b = 500000  # £5,000.00
        initial_total_system_balance = initial_balance_a + initial_balance_b

        acc_a_number = f"ACT-CONC-{uuid.uuid4().hex[:6].upper()}"
        acc_b_number = f"ACT-CONC-{uuid.uuid4().hex[:6].upper()}"

        acc_a = Account(
            id=uuid.uuid4(),
            account_number=acc_a_number,
            user_id=user_a.id,
            currency="GBP",
            balance=initial_balance_a,
            status=AccountStatus.ACTIVE,
        )
        acc_b = Account(
            id=uuid.uuid4(),
            account_number=acc_b_number,
            user_id=user_b.id,
            currency="GBP",
            balance=initial_balance_b,
            status=AccountStatus.ACTIVE,
        )
        setup_session.add_all([acc_a, acc_b])
        await setup_session.commit()

        user_a_id = user_a.id
        user_b_id = user_b.id

    # Transfer task worker function running in its own independent database session
    async def perform_transfer(sender_acc_no: str, receiver_acc_no: str, sender_user_id: uuid.UUID, amount: int, idx: int):
        async with session_factory() as session:
            # Reconstruct dummy user for session context
            user = User(id=sender_user_id, role=UserRole.CUSTOMER, is_active=True, email="test@test.com", full_name="User", hashed_password="")
            transfer, _ = await execute_transfer(
                db=session,
                current_user=user,
                sender_account_number=sender_acc_no,
                receiver_account_number=receiver_acc_no,
                amount_pence=amount,
                currency="GBP",
                reference=f"CONC-TRF-{idx:03d}-{uuid.uuid4().hex[:4]}",
                narration=f"Parallel transfer #{idx}",
            )
            return transfer.id

    # 2. Build 50 parallel transfer tasks (25 A->B, 25 B->A)
    transfer_amount = 1000  # £10.00 each
    tasks = []
    for i in range(25):
        # A -> B
        tasks.append(perform_transfer(acc_a_number, acc_b_number, user_a_id, transfer_amount, i))
        # B -> A (Bidirectional cross transfers: deadlock torture test)
        tasks.append(perform_transfer(acc_b_number, acc_a_number, user_b_id, transfer_amount, i + 25))

    # 3. Fire all 50 transfers simultaneously
    results = await asyncio.gather(*tasks, return_exceptions=False)
    assert len(results) == 50, f"Expected 50 successful transfers, got {len(results)}"

    # 4. Verify post-concurrency balances
    async with session_factory() as verify_session:
        stmt_a = select(Account).where(Account.account_number == acc_a_number)
        acc_a_final = (await verify_session.execute(stmt_a)).scalar_one()

        stmt_b = select(Account).where(Account.account_number == acc_b_number)
        acc_b_final = (await verify_session.execute(stmt_b)).scalar_one()

        final_total_system_balance = acc_a_final.balance + acc_b_final.balance

        # INVARIANT 1: Mathematical conservation of money
        assert final_total_system_balance == initial_total_system_balance, (
            f"Money was created or lost! Initial: {initial_total_system_balance}, Final: {final_total_system_balance}"
        )

        # INVARIANT 2: Symmetrical net change (25 * 1000 sent, 25 * 1000 received)
        assert acc_a_final.balance == initial_balance_a, f"Account A balance mismatch: {acc_a_final.balance} != {initial_balance_a}"
        assert acc_b_final.balance == initial_balance_b, f"Account B balance mismatch: {acc_b_final.balance} != {initial_balance_b}"

        # INVARIANT 3: Double-entry ledger exactness across the 50 transfers
        stmt_entries = (
            select(LedgerEntry.entry_type, func.sum(LedgerEntry.amount))
            .where(LedgerEntry.account_id.in_([acc_a_final.id, acc_b_final.id]))
            .group_by(LedgerEntry.entry_type)
        )
        ledger_sums = dict((await verify_session.execute(stmt_entries)).all())

        assert ledger_sums[EntryType.DEBIT] == ledger_sums[EntryType.CREDIT]
        assert ledger_sums[EntryType.DEBIT] == 50 * transfer_amount
