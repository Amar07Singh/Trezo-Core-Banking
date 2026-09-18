
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.account import AccountBalanceResponse, AccountCreate, AccountResponse
from app.services.account_service import (
    create_account,
    get_account_by_number,
    get_user_accounts,
)

router = APIRouter()


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_new_account(
    account_in: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await create_account(
        db=db,
        user=current_user,
        currency=account_in.currency,
        initial_deposit=account_in.initial_deposit,
    )
    return account


@router.get("", response_model=list[AccountResponse])
async def list_my_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts = await get_user_accounts(db=db, user_id=current_user.id)
    return accounts


@router.get("/{account_number}", response_model=AccountResponse)
async def get_account_details(
    account_number: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_account_by_number(db=db, account_number=account_number)
    # Ensure user owns account or is admin
    if account.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this account")
    return account


@router.get("/{account_number}/balance", response_model=AccountBalanceResponse)
async def get_account_balance(
    account_number: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_account_by_number(db=db, account_number=account_number)
    if account.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this account")
    
    formatted = f"{account.currency} {account.balance / 100:.2f}"
    return AccountBalanceResponse(
        account_number=account.account_number,
        currency=account.currency,
        balance=account.balance,
        status=account.status,
        formatted_balance=formatted,
    )
