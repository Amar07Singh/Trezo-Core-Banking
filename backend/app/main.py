import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import (
    BankingException,
    banking_exception_handler,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import logger
from app.core.middleware import CorrelationIdMiddleware, InstanceIdMiddleware
from app.services.outbox_worker import run_outbox_worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "server_starting",
        instance_id=settings.INSTANCE_ID,
        environment=settings.ENVIRONMENT,
    )
    # Start in-process background outbox processor task
    worker_task = asyncio.create_task(run_outbox_worker_loop(poll_interval=2.0))
    yield
    logger.info("server_shutting_down", instance_id=settings.INSTANCE_ID)
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ACID-Safe Core Banking Platform API with Double-Entry Ledger, Idempotency, and Fraud Engine",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Custom Middlewares
app.add_middleware(InstanceIdMiddleware)
app.add_middleware(CorrelationIdMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID", "X-Served-By", "X-Cache-Lookup", "Idempotency-Key"],
)

# RFC 7807 Error Handlers
app.add_exception_handler(BankingException, banking_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Routers
app.include_router(api_router, prefix=settings.API_V1_STR)

# Top-level Health shortcuts
@app.get("/health", tags=["Health & Probes"])
async def root_health():
    return {
        "status": "healthy",
        "instance_id": settings.INSTANCE_ID,
        "environment": settings.ENVIRONMENT,
    }

@app.get("/ready", tags=["Health & Probes"])
async def root_ready():
    return {"status": "ready", "instance_id": settings.INSTANCE_ID}
