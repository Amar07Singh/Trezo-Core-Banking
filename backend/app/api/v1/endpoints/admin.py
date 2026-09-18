
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.config import settings
from app.models.account import Account
from app.models.audit import AuditLog
from app.models.outbox import OutboxEvent, OutboxStatus
from app.models.transfer import Transfer, TransferStatus
from app.models.user import User
from app.schemas.account import AccountResponse
from app.schemas.admin import (
    AccountStatusUpdate,
    AuditLogResponse,
    OutboxEventResponse,
    SystemStatsResponse,
)
from app.schemas.transfer import TransferResponse
from app.services.account_service import update_account_status

router = APIRouter()


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/transfers/flagged", response_model=list[TransferResponse])
async def list_flagged_transfers(
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Transfer)
        .where(Transfer.status == TransferStatus.FLAGGED)
        .order_by(desc(Transfer.created_at))
    )
    result = await db.execute(stmt)
    transfers = list(result.scalars().all())
    if transfers:
        acc_ids = {t.sender_account_id for t in transfers} | {t.receiver_account_id for t in transfers}
        acc_stmt = select(Account.id, Account.account_number).where(Account.id.in_(acc_ids))
        acc_map = dict((await db.execute(acc_stmt)).all())
        for t in transfers:
            t.sender_account_number = acc_map.get(t.sender_account_id)
            t.receiver_account_number = acc_map.get(t.receiver_account_id)
    return transfers


@router.get("/transfers/recent", response_model=list[TransferResponse])
async def list_recent_transfers(
    limit: int = Query(10, ge=1, le=50),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Transfer)
        .order_by(desc(Transfer.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    transfers = list(result.scalars().all())
    if transfers:
        acc_ids = {t.sender_account_id for t in transfers} | {t.receiver_account_id for t in transfers}
        acc_stmt = select(Account.id, Account.account_number).where(Account.id.in_(acc_ids))
        acc_map = dict((await db.execute(acc_stmt)).all())
        for t in transfers:
            t.sender_account_number = acc_map.get(t.sender_account_id)
            t.receiver_account_number = acc_map.get(t.receiver_account_id)
    return transfers


@router.patch("/accounts/{account_number}/status", response_model=AccountResponse)
async def change_account_status(
    account_number: str,
    status_in: AccountStatusUpdate,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    updated = await update_account_status(
        db=db,
        account_number=account_number,
        new_status=status_in.status,
        admin_user=admin_user,
    )
    return updated


@router.get("/outbox", response_model=list[OutboxEventResponse])
async def list_outbox_events(
    limit: int = Query(50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(OutboxEvent).order_by(desc(OutboxEvent.created_at)).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_accounts = (await db.execute(select(func.count(Account.id)))).scalar() or 0
    total_transfers = (await db.execute(select(func.count(Transfer.id)))).scalar() or 0
    total_volume = (await db.execute(select(func.sum(Transfer.amount)))).scalar() or 0
    pending_outbox = (
        await db.execute(
            select(func.count(OutboxEvent.id)).where(OutboxEvent.status == OutboxStatus.PENDING)
        )
    ).scalar() or 0

    return SystemStatsResponse(
        total_users=total_users,
        total_accounts=total_accounts,
        total_transfers=total_transfers,
        total_volume_pence=total_volume,
        pending_outbox_events=pending_outbox,
        active_instances=[settings.INSTANCE_ID],
    )
