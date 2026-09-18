import pytest
from sqlalchemy import select

from app.models.outbox import OutboxEvent, OutboxStatus
from app.services.outbox_worker import process_outbox_batch
from app.services.transfer_service import execute_transfer


@pytest.mark.asyncio
async def test_outbox_creation_and_worker_processing(db_session, seed_users_and_accounts):
    alice = seed_users_and_accounts["alice"]
    alice_acc = seed_users_and_accounts["alice_acc"]
    bob_acc = seed_users_and_accounts["bob_acc"]

    # 1. Transfer triggers atomic outbox event creation
    transfer, _ = await execute_transfer(
        db=db_session,
        current_user=alice,
        sender_account_number=alice_acc.account_number,
        receiver_account_number=bob_acc.account_number,
        amount_pence=1000,
        currency="GBP",
    )

    stmt = select(OutboxEvent).where(OutboxEvent.aggregate_id == str(transfer.id))
    event = (await db_session.execute(stmt)).scalar_one_or_none()
    assert event is not None
    assert event.status in (OutboxStatus.PENDING, OutboxStatus.PROCESSED)
    assert event.payload["transfer_id"] == str(transfer.id)

    # 2. Worker processes the batch
    if event.status == OutboxStatus.PENDING:
        processed_count = await process_outbox_batch(db_session, batch_size=10)
        assert processed_count >= 1

    await db_session.refresh(event)
    assert event.status == OutboxStatus.PROCESSED
    assert event.processed_at is not None
