import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, CheckConstraint, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.ledger import LedgerEntry
    from app.models.transfer import Transfer
    from app.models.user import User


class AccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    FROZEN = "FROZEN"
    CLOSED = "CLOSED"


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"
    __table_args__ = (
        CheckConstraint("balance >= 0", name="chk_account_balance_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_number: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    currency: Mapped[str] = mapped_column(String(3), default="GBP", nullable=False)
    balance: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus, name="account_status_enum", native_enum=False),
        default=AccountStatus.ACTIVE,
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="accounts")
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship("LedgerEntry", back_populates="account")
    sent_transfers: Mapped[list["Transfer"]] = relationship(
        "Transfer", foreign_keys="Transfer.sender_account_id", back_populates="sender_account"
    )
    received_transfers: Mapped[list["Transfer"]] = relationship(
        "Transfer", foreign_keys="Transfer.receiver_account_id", back_populates="receiver_account"
    )
