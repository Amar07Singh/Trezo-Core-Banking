import asyncio
from app.services.outbox_worker import run_outbox_worker_loop
from app.core.logging import logger

if __name__ == "__main__":
    logger.info("starting_standalone_outbox_worker")
    try:
        asyncio.run(run_outbox_worker_loop(poll_interval=1.0))
    except KeyboardInterrupt:
        logger.info("stopping_outbox_worker")
