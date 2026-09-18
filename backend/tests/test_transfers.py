import pytest
from sqlalchemy import select

from app.core.errors import (
    AccountInactiveException,
    InsufficientFundsException,
    SameAccountTransferException,
)
from app.models.account import AccountStatus
from app.models.ledger import EntryType, LedgerEntry
from app.services.transfer_service import execute_transfer


@pytest.mark.asyncio
async def test_transfer_success_and_ledger_invariant(db_session, seed_users_and_accounts):
    alice = seed_users_and_accounts["alice"]
    alice_acc = seed_users_and_accounts["alice_acc"]
    bob_acc = seed_users_and_accounts["bob_acc"]

    initial_alice_balance = alice_acc.balance
    initial_bob_balance = bob_acc.balance
    transfer_amount = 15000  # £150.00

    transfer, was_cached = await execute_transfer(
        db=db_session,
        current_user=alice,
        sender_account_number=alice_acc.account_number,
        receiver_account_number=bob_acc.account_number,
        amount_pence=transfer_amount,
        currency="GBP",
        narration="Payment for consulting services",
    )

    assert transfer.status.value in ["COMPLETED", "FLAGGED"]
    assert transfer.amount == transfer_amount

    # Verify updated balances
    await db_session.refresh(alice_acc)
    await db_session.refresh(bob_acc)

    assert alice_acc.balance == initial_alice_balance - transfer_amount
    assert bob_acc.balance == initial_bob_balance + transfer_amount

    # Verify double-entry ledger legs
    stmt = select(LedgerEntry).where(LedgerEntry.journal_id == transfer.journal_id)
    legs = list((await db_session.execute(stmt)).scalars().all())
    assert len(legs) == 2

    debit_legs = [leg for leg in legs if leg.entry_type == EntryType.DEBIT]
    credit_legs = [leg for leg in legs if leg.entry_type == EntryType.CREDIT]

    assert len(debit_legs) == 1
    assert len(credit_legs) == 1
    assert debit_legs[0].account_id == alice_acc.id
    assert debit_legs[0].amount == transfer_amount
    assert debit_legs[0].balance_after == alice_acc.balance

    assert credit_legs[0].account_id == bob_acc.id
    assert credit_legs[0].amount == transfer_amount
    assert credit_legs[0].balance_after == bob_acc.balance

    # Double-entry invariant: Sum of Debits == Sum of Credits
    assert sum(leg.amount for leg in debit_legs) == sum(leg.amount for leg in credit_legs)


@pytest.mark.asyncio
async def test_transfer_insufficient_funds_raises_error(db_session, seed_users_and_accounts):
    alice = seed_users_and_accounts["alice"]
    alice_acc = seed_users_and_accounts["alice_acc"]
    bob_acc = seed_users_and_accounts["bob_acc"]

    excessive_amount = alice_acc.balance + 500000

    with pytest.raises(InsufficientFundsException) as exc_info:
        await execute_transfer(
            db=db_session,
            current_user=alice,
            sender_account_number=alice_acc.account_number,
            receiver_account_number=bob_acc.account_number,
            amount_pence=excessive_amount,
            currency="GBP",
        )
    assert "Insufficient Funds" in str(exc_info.value.title)


@pytest.mark.asyncio
async def test_transfer_same_account_fails(db_session, seed_users_and_accounts):
    alice = seed_users_and_accounts["alice"]
    alice_acc = seed_users_and_accounts["alice_acc"]

    with pytest.raises(SameAccountTransferException):
        await execute_transfer(
            db=db_session,
            current_user=alice,
            sender_account_number=alice_acc.account_number,
            receiver_account_number=alice_acc.account_number,
            amount_pence=1000,
        )


@pytest.mark.asyncio
async def test_transfer_frozen_account_fails(db_session, seed_users_and_accounts):
    alice = seed_users_and_accounts["alice"]
    alice_acc = seed_users_and_accounts["alice_acc"]
    bob_acc = seed_users_and_accounts["bob_acc"]

    alice_acc.status = AccountStatus.FROZEN
    await db_session.commit()

    with pytest.raises(AccountInactiveException):
        await execute_transfer(
            db=db_session,
            current_user=alice,
            sender_account_number=alice_acc.account_number,
            receiver_account_number=bob_acc.account_number,
            amount_pence=1000,
        )
    # Restore
    alice_acc.status = AccountStatus.ACTIVE
    await db_session.commit()
