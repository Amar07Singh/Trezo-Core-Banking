import hashlib
import uuid

from fastapi import APIRouter, Depends, Header, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.errors import AccountNotFoundException
from app.models.transfer import Transfer
from app.models.user import User
from app.schemas.transfer import TransferCreate, TransferResponse
from app.services.transfer_service import check_idempotency, execute_transfer

router = APIRouter()


@router.post("", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    transfer_in: TransferCreate,
    request: Request,
    response: Response,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Idempotency Check & Replay
    if idempotency_key:
        payload_str = f"{transfer_in.sender_account_number}:{transfer_in.receiver_account_number}:{transfer_in.amount}:{transfer_in.currency}"
        req_hash = hashlib.sha256(payload_str.encode()).hexdigest()
        
        cached_result = await check_idempotency(db, idempotency_key, req_hash)
        if cached_result:
            cached_status, cached_data = cached_result
            return JSONResponse(
                status_code=cached_status,
                content=cached_data,
                headers={"X-Cache-Lookup": "HIT", "Idempotency-Key": idempotency_key},
            )

    # 2. Execute ACID Transfer
    client_ip = request.client.host if request.client else None
    transfer, was_cached = await execute_transfer(
        db=db,
        current_user=current_user,
        sender_account_number=transfer_in.sender_account_number,
        receiver_account_number=transfer_in.receiver_account_number,
        amount_pence=transfer_in.amount,
        currency=transfer_in.currency,
        reference=transfer_in.reference,
        narration=transfer_in.narration,
        idempotency_key=idempotency_key,
        ip_address=client_ip,
    )

    response.headers["X-Cache-Lookup"] = "MISS"
    if idempotency_key:
        response.headers["Idempotency-Key"] = idempotency_key

    return transfer


@router.get("/{transfer_id}", response_model=TransferResponse)
async def get_transfer(
    transfer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Transfer).where(Transfer.id == transfer_id)
    transfer = (await db.execute(stmt)).scalar_one_or_none()
    if not transfer:
        raise AccountNotFoundException(f"Transfer {transfer_id}")
    return transfer
