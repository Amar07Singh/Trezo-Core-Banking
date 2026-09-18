import uuid

import pytest

from app.core.errors import IdempotencyConflictException
from app.services.transfer_service import execute_transfer


@pytest.mark.asyncio
async def test_idempotency_replay_prevents_double_debit(db_session, seed_users_and_accounts):
    alice = seed_users_and_accounts["alice"]
    alice_acc = seed_users_and_accounts["alice_acc"]
    bob_acc = seed_users_and_accounts["bob_acc"]

    initial_balance = alice_acc.balance
    transfer_amount = 5000  # £50.00
    idempotency_key = f"IDEMP-{uuid.uuid4()}"

    # 1. First execution
    t1, was_cached_1 = await execute_transfer(
        db=db_session,
        current_user=alice,
        sender_account_number=alice_acc.account_number,
        receiver_account_number=bob_acc.account_number,
        amount_pence=transfer_amount,
        currency="GBP",
        idempotency_key=idempotency_key,
    )
    assert was_cached_1 is False

    await db_session.refresh(alice_acc)
    balance_after_first = alice_acc.balance
    assert balance_after_first == initial_balance - transfer_amount

    # 2. Simulate API endpoint call with same idempotency key
    # Calling endpoint directly or service check
    import hashlib

    from app.services.transfer_service import check_idempotency

    payload_str = f"{alice_acc.account_number}:{bob_acc.account_number}:{transfer_amount}:GBP"
    req_hash = hashlib.sha256(payload_str.encode()).hexdigest()

    cached_res = await check_idempotency(db_session, idempotency_key, req_hash)
    assert cached_res is not None
    status_code, cached_payload = cached_res
    assert status_code == 201
    assert cached_payload["amount"] == transfer_amount
    assert cached_payload["id"] == str(t1.id)

    # 3. Verify balance was NOT debited again
    await db_session.refresh(alice_acc)
    assert alice_acc.balance == balance_after_first


@pytest.mark.asyncio
async def test_idempotency_payload_mismatch_conflict(db_session, seed_users_and_accounts):
    alice = seed_users_and_accounts["alice"]
    alice_acc = seed_users_and_accounts["alice_acc"]
    bob_acc = seed_users_and_accounts["bob_acc"]

    idempotency_key = f"IDEMP-MISMATCH-{uuid.uuid4()}"

    await execute_transfer(
        db=db_session,
        current_user=alice,
        sender_account_number=alice_acc.account_number,
        receiver_account_number=bob_acc.account_number,
        amount_pence=2000,
        currency="GBP",
        idempotency_key=idempotency_key,
    )

    from app.services.transfer_service import check_idempotency
    # Different hash / parameters
    mismatched_hash = "different_hash_value_12345"

    with pytest.raises(IdempotencyConflictException):
        await check_idempotency(db_session, idempotency_key, mismatched_hash)
