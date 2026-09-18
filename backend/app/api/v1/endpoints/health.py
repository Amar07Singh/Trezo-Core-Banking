from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    Liveness probe: verifies the process is responsive.
    """
    return {
        "status": "healthy",
        "instance_id": settings.INSTANCE_ID,
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
    }


@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe: verifies database connectivity and pool health.
    """
    try:
        await db.execute(text("SELECT 1"))
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "ready",
                "database": "connected",
                "instance_id": settings.INSTANCE_ID,
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(exc),
                "instance_id": settings.INSTANCE_ID,
            },
        )
