import asyncio
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session_context
from app.core.logging import logger
from app.models.outbox import OutboxEvent, OutboxStatus


async def process_outbox_batch(db: AsyncSession, batch_size: int = 10) -> int:
    """
    Polls and locks pending outbox events using PostgreSQL 'FOR UPDATE SKIP LOCKED'.
    Guarantees:
    - Multiple concurrent workers can run simultaneously without duplicate processing.
    - Zero lock contention between workers.
    """
    stmt = (
        select(OutboxEvent)
        .where(OutboxEvent.status == OutboxStatus.PENDING)
        .order_by(OutboxEvent.created_at.asc())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )
    result = await db.execute(stmt)
    events = list(result.scalars().all())

    if not events:
        return 0

    processed_count = 0
    for event in events:
        try:
            event.status = OutboxStatus.PROCESSING
            await db.flush()

            # Process event (e.g. publish async notification / webhook dispatch)
            logger.info(
                "outbox_event_dispatching",
                event_id=str(event.id),
                event_type=event.event_type,
                aggregate_id=event.aggregate_id,
            )

            # Mark processed
            event.status = OutboxStatus.PROCESSED
            event.processed_at = datetime.now(UTC)
            processed_count += 1
        except Exception as exc:
            event.retry_count += 1
            event.error_message = str(exc)
            if event.retry_count >= 5:
                event.status = OutboxStatus.FAILED
            else:
                event.status = OutboxStatus.PENDING
            logger.error("outbox_event_failed", event_id=str(event.id), error=str(exc))

    await db.commit()
    return processed_count


async def run_outbox_worker_loop(poll_interval: float = 2.0, run_once: bool = False):
    """
    Continuous background worker loop.
    """
    logger.info("outbox_worker_started", interval=poll_interval)
    while True:
        try:
            async with get_async_session_context() as db:
                count = await process_outbox_batch(db, batch_size=10)
                if count > 0:
                    logger.info("outbox_batch_processed", count=count)
        except Exception as exc:
            logger.error("outbox_worker_loop_error", error=str(exc))

        if run_once:
            break
        await asyncio.sleep(poll_interval)
