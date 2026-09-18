import secrets
import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AccountNotFoundException
from app.models.account import Account, AccountStatus
from app.models.ledger import EntryType, JournalEntry, LedgerEntry
from app.models.user import User
from app.schemas.statement import StatementEntryResponse, StatementResponse
from app.services.audit_service import record_audit_log


def generate_account_number() -> str:
    """Generates an 8-digit UK-style account identifier."""
    digits = "".join([str(secrets.randbelow(10)) for _ in range(8)])
    return f"ACT-GB{digits}"


async def create_account(
    db: AsyncSession,
    user: User,
    currency: str = "GBP",
    initial_deposit: int = 0,
) -> Account:
    """
    Creates a new banking account.
    If initial_deposit > 0, records a double-entry funding journal transaction.
    """
    account_number = generate_account_number()
    account = Account(
        id=uuid.uuid4(),
        account_number=account_number,
        user_id=user.id,
        currency=currency.upper(),
        balance=initial_deposit,
        status=AccountStatus.ACTIVE,
    )
    db.add(account)
    await db.flush()

    if initial_deposit > 0:
        # Create funding journal entry
        journal = JournalEntry(
            id=uuid.uuid4(),
            reference=f"INIT-DEP-{account.account_number}",
            narration=f"Initial deposit funding for account {account.account_number}",
        )
        db.add(journal)
        await db.flush()

        # Ledger credit leg to the new account
        credit_leg = LedgerEntry(
            id=uuid.uuid4(),
            journal_id=journal.id,
            account_id=account.id,
            entry_type=EntryType.CREDIT,
            amount=initial_deposit,
            balance_after=initial_deposit,
        )
        db.add(credit_leg)

    await record_audit_log(
        db=db,
        action="ACCOUNT_CREATED",
        resource_type="ACCOUNT",
        resource_id=str(account.id),
        user_id=user.id,
        after_state={"account_number": account.account_number, "currency": account.currency, "balance": account.balance},
    )

    await db.commit()
    await db.refresh(account)
    return account


async def get_account_by_number(db: AsyncSession, account_number: str) -> Account:
    stmt = select(Account).where(Account.account_number == account_number)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    if not account:
        raise AccountNotFoundException(account_number)
    return account


async def get_account_by_id(db: AsyncSession, account_id: uuid.UUID) -> Account:
    stmt = select(Account).where(Account.id == account_id)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    if not account:
        raise AccountNotFoundException(str(account_id))
    return account


async def get_user_accounts(db: AsyncSession, user_id: uuid.UUID) -> list[Account]:
    stmt = select(Account).where(Account.user_id == user_id).order_by(Account.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_account_status(
    db: AsyncSession,
    account_number: str,
    new_status: AccountStatus,
    admin_user: User,
) -> Account:
    account = await get_account_by_number(db, account_number)
    before = {"status": account.status.value}
    account.status = new_status
    await record_audit_log(
        db=db,
        action=f"ACCOUNT_STATUS_{new_status.value}",
        resource_type="ACCOUNT",
        resource_id=str(account.id),
        user_id=admin_user.id,
        before_state=before,
        after_state={"status": account.status.value},
    )
    await db.commit()
    await db.refresh(account)
    return account


async def get_account_statement(
    db: AsyncSession,
    account_number: str,
    page: int = 1,
    page_size: int = 20,
) -> StatementResponse:
    account = await get_account_by_number(db, account_number)

    # Count total entries
    count_stmt = (
        select(func.count(LedgerEntry.id))
        .where(LedgerEntry.account_id == account.id)
    )
    total_count = (await db.execute(count_stmt)).scalar() or 0

    # Paginated ledger entries joined with journal
    offset = (page - 1) * page_size
    stmt = (
        select(LedgerEntry, JournalEntry)
        .join(JournalEntry, LedgerEntry.journal_id == JournalEntry.id)
        .where(LedgerEntry.account_id == account.id)
        .order_by(desc(LedgerEntry.created_at))
        .offset(offset)
        .limit(page_size)
    )
    results = (await db.execute(stmt)).all()

    entries = []
    for ledger_entry, journal in results:
        entries.append(
            StatementEntryResponse(
                id=ledger_entry.id,
                entry_type=ledger_entry.entry_type,
                amount=ledger_entry.amount,
                balance_after=ledger_entry.balance_after,
                reference=journal.reference,
                narration=journal.narration,
                timestamp=ledger_entry.created_at,
            )
        )

    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

    return StatementResponse(
        account_number=account.account_number,
        currency=account.currency,
        current_balance=account.balance,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        entries=entries,
    )
