from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.statement import StatementResponse
from app.services.account_service import get_account_by_number, get_account_statement

router = APIRouter()


@router.get("/{account_number}/statement", response_model=StatementResponse)
async def get_statement(
    account_number: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_account_by_number(db=db, account_number=account_number)
    if account.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to statement")

    statement = await get_account_statement(
        db=db,
        account_number=account_number,
        page=page,
        page_size=page_size,
    )
    return statement
