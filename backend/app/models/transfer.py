import enum
import uuid
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, BigInteger, CheckConstraint, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.ledger import JournalEntry


class TransferStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    FLAGGED = "FLAGGED"


class Transfer(Base, TimestampMixin):
    __tablename__ = "transfers"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_transfer_amount_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sender_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    receiver_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[TransferStatus] = mapped_column(
        Enum(TransferStatus, name="transfer_status_enum", native_enum=False),
        default=TransferStatus.PENDING,
        nullable=False,
        index=True,
    )
    reference: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    fraud_flags: Mapped[Any | None] = mapped_column(JSON, default=list, nullable=True)
    journal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True
    )

    sender_account: Mapped["Account"] = relationship(
        "Account", foreign_keys=[sender_account_id], back_populates="sent_transfers"
    )
    receiver_account: Mapped["Account"] = relationship(
        "Account", foreign_keys=[receiver_account_id], back_populates="received_transfers"
    )
    journal: Mapped[Optional["JournalEntry"]] = relationship("JournalEntry")
