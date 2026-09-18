import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.account import AccountStatus
from app.models.outbox import OutboxStatus


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    resource_type: str
    resource_id: str
    before_state: Any | None
    after_state: Any | None
    ip_address: str | None
    created_at: datetime


class OutboxEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    aggregate_id: str
    payload: Any
    status: OutboxStatus
    retry_count: int
    error_message: str | None
    created_at: datetime
    processed_at: datetime | None


class AccountStatusUpdate(BaseModel):
    status: AccountStatus


class SystemStatsResponse(BaseModel):
    total_users: int
    total_accounts: int
    total_transfers: int
    total_volume_pence: int
    pending_outbox_events: int
    active_instances: list[str]
