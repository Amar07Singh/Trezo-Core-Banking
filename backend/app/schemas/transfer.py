import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.transfer import TransferStatus


class TransferCreate(BaseModel):
    sender_account_number: str
    receiver_account_number: str
    amount: int = Field(gt=0, description="Transfer amount in minor units (e.g. pence)")
    currency: str = Field(default="GBP", max_length=3, min_length=3)
    reference: str | None = Field(default=None, max_length=64)
    narration: str | None = Field(default="Standard Account Transfer")


class TransferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_account_id: uuid.UUID
    receiver_account_id: uuid.UUID
    sender_account_number: str | None = None
    receiver_account_number: str | None = None
    amount: int
    currency: str
    status: TransferStatus
    reference: str
    fraud_flags: list[Any] | None = None
    journal_id: uuid.UUID | None = None
    created_at: datetime
