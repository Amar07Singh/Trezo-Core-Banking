import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.audit import AuditLog


async def record_audit_log(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: str,
    user_id: uuid.UUID | None = None,
    before_state: Any | None = None,
    after_state: Any | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """
    Append-only audit logging directly to the PostgreSQL audit_logs table.
    Ensures an immutable operational audit trail for all critical banking actions.
    """
    log_entry = AuditLog(
        id=uuid.uuid4(),
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        before_state=before_state,
        after_state=after_state,
        ip_address=ip_address,
    )
    db.add(log_entry)
    logger.info(
        "audit_log_recorded",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=str(user_id) if user_id else None,
    )
    return log_entry
