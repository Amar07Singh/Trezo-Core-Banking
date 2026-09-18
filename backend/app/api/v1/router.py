from fastapi import APIRouter

from app.api.v1.endpoints import (
    accounts,
    admin,
    auth,
    health,
    statements,
    transfers,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health & Probes"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Account Management"])
api_router.include_router(transfers.router, prefix="/transfers", tags=["Fund Transfers & Idempotency"])
api_router.include_router(statements.router, prefix="/accounts", tags=["Statements & Ledger"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin Operations & Audit"])
