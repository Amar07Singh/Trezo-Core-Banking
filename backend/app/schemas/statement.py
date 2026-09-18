import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.ledger import EntryType


class StatementEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entry_type: EntryType
    amount: int
    balance_after: int
    reference: str
    narration: str
    timestamp: datetime


class StatementResponse(BaseModel):
    account_number: str
    currency: str
    current_balance: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    entries: list[StatementEntryResponse]
