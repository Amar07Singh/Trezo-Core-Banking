import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import get_async_session_context, engine
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.account import Account, AccountStatus
from app.models.ledger import JournalEntry, LedgerEntry, EntryType
from app.models.audit import AuditLog
from app.core.security import get_password_hash
from app.core.logging import logger


async def seed_database():
    logger.info("beginning_database_seed")
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with get_async_session_context() as db:
        # Check if already seeded
        res = await db.execute(select(User).where(User.email == "admin@bank.natwest.com"))
        if res.scalar_one_or_none():
            logger.info("database_already_seeded_skipping")
            return

        # 1. Admin
        admin = User(
            id=uuid.uuid4(),
            email="admin@bank.natwest.com",
            hashed_password=get_password_hash("AdminSecret123!"),
            full_name="NatWest Chief Risk Officer",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)

        # 2. Customers
        customers_data = [
            ("alice@example.com", "AlicePass123!", "Alice Smith", "ACT-GB1001", 1000000),  # £10,000.00
            ("bob@example.com", "BobPass123!", "Bob Jones", "ACT-GB1002", 500000),         # £5,000.00
            ("charlie@example.com", "CharliePass123!", "Charlie Brown", "ACT-GB1003", 250000), # £2,500.00
        ]

        for email, pwd, name, acc_num, initial_bal in customers_data:
            user = User(
                id=uuid.uuid4(),
                email=email,
                hashed_password=get_password_hash(pwd),
                full_name=name,
                role=UserRole.CUSTOMER,
                is_active=True,
            )
            db.add(user)
            await db.flush()

            account = Account(
                id=uuid.uuid4(),
                account_number=acc_num,
                user_id=user.id,
                currency="GBP",
                balance=initial_bal,
                status=AccountStatus.ACTIVE,
            )
            db.add(account)
            await db.flush()

            # Double-entry ledger entry for initial capital funding
            journal = JournalEntry(
                id=uuid.uuid4(),
                reference=f"INIT-FUND-{acc_num}",
                narration=f"Initial seed capital for {acc_num}",
            )
            db.add(journal)
            await db.flush()

            credit_leg = LedgerEntry(
                id=uuid.uuid4(),
                journal_id=journal.id,
                account_id=account.id,
                entry_type=EntryType.CREDIT,
                amount=initial_bal,
                balance_after=initial_bal,
            )
            db.add(credit_leg)

            # Audit record
            audit = AuditLog(
                id=uuid.uuid4(),
                user_id=admin.id,
                action="SEED_ACCOUNT_CREATION",
                resource_type="ACCOUNT",
                resource_id=str(account.id),
                after_state={"account_number": acc_num, "balance": initial_bal},
            )
            db.add(audit)

        await db.commit()
        logger.info("database_seeded_successfully")


if __name__ == "__main__":
    asyncio.run(seed_database())
