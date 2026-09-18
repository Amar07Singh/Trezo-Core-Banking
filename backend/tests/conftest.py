import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.account import Account, AccountStatus
from app.models.base import Base
from app.models.ledger import EntryType, JournalEntry, LedgerEntry
from app.models.user import User, UserRole


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    engine = create_async_engine(settings.async_db_url, poolclass=NullPool, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    async_session = async_sessionmaker(
        bind=async_engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client


@pytest_asyncio.fixture(scope="function")
async def seed_users_and_accounts(db_session: AsyncSession):
    # Unique suffix to avoid email/account clashes between tests
    uid = uuid.uuid4().hex[:6]

    admin = User(
        id=uuid.uuid4(),
        email=f"admin_{uid}@natwest.com",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Test Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)

    alice = User(
        id=uuid.uuid4(),
        email=f"alice_{uid}@example.com",
        hashed_password=get_password_hash("AlicePass123!"),
        full_name="Alice Test",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(alice)

    bob = User(
        id=uuid.uuid4(),
        email=f"bob_{uid}@example.com",
        hashed_password=get_password_hash("BobPass123!"),
        full_name="Bob Test",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(bob)
    await db_session.flush()

    alice_acc = Account(
        id=uuid.uuid4(),
        account_number=f"ACT-A-{uid}",
        user_id=alice.id,
        currency="GBP",
        balance=100000,
        status=AccountStatus.ACTIVE,
    )
    db_session.add(alice_acc)

    bob_acc = Account(
        id=uuid.uuid4(),
        account_number=f"ACT-B-{uid}",
        user_id=bob.id,
        currency="GBP",
        balance=50000,
        status=AccountStatus.ACTIVE,
    )
    db_session.add(bob_acc)
    await db_session.flush()

    journal = JournalEntry(
        id=uuid.uuid4(),
        reference=f"INIT-FUND-{uid}",
        narration="Initial test funding",
    )
    db_session.add(journal)
    await db_session.flush()

    db_session.add(LedgerEntry(
        id=uuid.uuid4(),
        journal_id=journal.id,
        account_id=alice_acc.id,
        entry_type=EntryType.CREDIT,
        amount=100000,
        balance_after=100000,
    ))
    db_session.add(LedgerEntry(
        id=uuid.uuid4(),
        journal_id=journal.id,
        account_id=bob_acc.id,
        entry_type=EntryType.CREDIT,
        amount=50000,
        balance_after=50000,
    ))
    await db_session.commit()

    return {
        "admin": admin,
        "alice": alice,
        "bob": bob,
        "alice_acc": alice_acc,
        "bob_acc": bob_acc,
    }


@pytest.fixture
def alice_token(seed_users_and_accounts) -> str:
    alice = seed_users_and_accounts["alice"]
    return create_access_token(data={"sub": str(alice.id), "email": alice.email, "role": alice.role.value})


@pytest.fixture
def admin_token(seed_users_and_accounts) -> str:
    admin = seed_users_and_accounts["admin"]
    return create_access_token(data={"sub": str(admin.id), "email": admin.email, "role": admin.role.value})
