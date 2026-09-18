import logging
import sys
from contextvars import ContextVar

# Context variable to hold correlation ID across async tasks
correlation_id_ctx: ContextVar[str | None] = ContextVar("correlation_id_ctx", default=None)

def get_correlation_id() -> str | None:
    return correlation_id_ctx.get()

def set_correlation_id(correlation_id: str) -> None:
    correlation_id_ctx.set(correlation_id)

try:
    import structlog

    def setup_logging(debug: bool = False):
        shared_processors = [
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
        ]

        if not debug:
            processors = shared_processors + [
                structlog.processors.dict_tracebacks,
                structlog.processors.JSONRenderer(),
            ]
        else:
            processors = shared_processors + [
                structlog.dev.ConsoleRenderer(),
            ]

        structlog.configure(
            processors=processors,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )

        handler = logging.StreamHandler(sys.stdout)
        logging.basicConfig(level=logging.DEBUG if debug else logging.INFO, handlers=[handler])
        return structlog.get_logger()

except ImportError:
    # Standard library fallback
    def setup_logging(debug: bool = False):
        logging.basicConfig(
            level=logging.DEBUG if debug else logging.INFO,
            format='{"time":"%(asctime)s", "level":"%(levelname)s", "logger":"%(name)s", "message":"%(message)s"}',
            stream=sys.stdout,
        )
        return logging.getLogger("core_banking")

logger = setup_logging(debug=False)
