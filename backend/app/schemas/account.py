import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.account import AccountStatus


class AccountCreate(BaseModel):
    currency: str = Field(default="GBP", max_length=3, min_length=3)
    initial_deposit: int = Field(default=0, ge=0, description="Initial deposit in minor units (e.g. pence)")


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_number: str
    user_id: uuid.UUID
    currency: str
    balance: int
    status: AccountStatus
    created_at: datetime


class AccountBalanceResponse(BaseModel):
    account_number: str
    currency: str
    balance: int
    status: AccountStatus
    formatted_balance: str
