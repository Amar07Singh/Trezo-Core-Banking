import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.transfer import Transfer


@dataclass
class TransferContext:
    sender_account_id: uuid.UUID
    receiver_account_id: uuid.UUID
    amount: int  # minor units (pence)
    currency: str
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(UTC)


@dataclass
class RuleResult:
    passed: bool
    rule_name: str
    action: str  # "ALLOW", "FLAG", "BLOCK"
    reason: str | None = None


class FraudRule(ABC):
    @abstractmethod
    async def evaluate(self, ctx: TransferContext, db: AsyncSession) -> RuleResult:
        """Evaluate the transfer context against this fraud/risk rule."""
        pass


class LargeAmountRule(FraudRule):
    """
    Checks if a single transaction amount exceeds the large transaction threshold.
    Flags or blocks excessive single money movements.
    """
    def __init__(self, threshold_pence: int | None = None):
        self.threshold_pence = threshold_pence or settings.FRAUD_LARGE_AMOUNT_THRESHOLD_PENCE

    async def evaluate(self, ctx: TransferContext, db: AsyncSession) -> RuleResult:
        if ctx.amount > self.threshold_pence:
            return RuleResult(
                passed=False,
                rule_name="LARGE_AMOUNT_CHECK",
                action="FLAG",
                reason=f"Transfer amount {ctx.amount} pence exceeds threshold of {self.threshold_pence} pence.",
            )
        return RuleResult(passed=True, rule_name="LARGE_AMOUNT_CHECK", action="ALLOW")


class RapidRepeatVelocityRule(FraudRule):
    """
    Velocity check: Counts the number of outgoing transfers from the sender
    in the last N seconds using an indexed PostgreSQL query.
    """
    def __init__(self, window_seconds: int | None = None, max_count: int | None = None):
        self.window_seconds = window_seconds or settings.FRAUD_RAPID_REPEAT_WINDOW_SECONDS
        self.max_count = max_count or settings.FRAUD_RAPID_REPEAT_MAX_COUNT

    async def evaluate(self, ctx: TransferContext, db: AsyncSession) -> RuleResult:
        since_time = ctx.timestamp - timedelta(seconds=self.window_seconds)
        stmt = (
            select(func.count(Transfer.id))
            .where(
                Transfer.sender_account_id == ctx.sender_account_id,
                Transfer.created_at >= since_time,
            )
        )
        result = await db.execute(stmt)
        count = result.scalar() or 0

        if count >= self.max_count:
            return RuleResult(
                passed=False,
                rule_name="RAPID_REPEAT_VELOCITY_CHECK",
                action="FLAG",
                reason=f"Velocity limit exceeded: {count} transfers initiated in the last {self.window_seconds}s (limit: {self.max_count}).",
            )
        return RuleResult(passed=True, rule_name="RAPID_REPEAT_VELOCITY_CHECK", action="ALLOW")


class OddHoursRule(FraudRule):
    """
    Detects unusual activity outside typical business/day hours (e.g. 01:00 - 05:00 UTC).
    """
    def __init__(self, start_hour: int | None = None, end_hour: int | None = None):
        self.start_hour = start_hour if start_hour is not None else settings.FRAUD_ODD_HOURS_START
        self.end_hour = end_hour if end_hour is not None else settings.FRAUD_ODD_HOURS_END

    async def evaluate(self, ctx: TransferContext, db: AsyncSession) -> RuleResult:
        hour = ctx.timestamp.hour
        if self.start_hour <= hour < self.end_hour:
            return RuleResult(
                passed=False,
                rule_name="ODD_HOURS_CHECK",
                action="FLAG",
                reason=f"Transaction initiated at {hour:02d}:00 UTC, within restricted risk window ({self.start_hour:02d}:00 - {self.end_hour:02d}:00 UTC).",
            )
        return RuleResult(passed=True, rule_name="ODD_HOURS_CHECK", action="ALLOW")


@dataclass
class FraudEvaluation:
    is_blocked: bool
    is_flagged: bool
    reasons: list[str]


class FraudEngine:
    """
    Strategy pattern orchestrator for risk assessment.
    Runs all configured fraud rules and determines final action.
    """
    def __init__(self, rules: list[FraudRule] | None = None):
        self.rules = rules or [
            LargeAmountRule(),
            RapidRepeatVelocityRule(),
            OddHoursRule(),
        ]

    async def evaluate_transfer(self, ctx: TransferContext, db: AsyncSession) -> FraudEvaluation:
        flags = []
        is_blocked = False

        for rule in self.rules:
            result = await rule.evaluate(ctx, db)
            if not result.passed:
                flags.append(f"[{result.rule_name}] {result.reason}")
                if result.action == "BLOCK":
                    is_blocked = True

        return FraudEvaluation(
            is_blocked=is_blocked,
            is_flagged=len(flags) > 0,
            reasons=flags,
        )


default_fraud_engine = FraudEngine()
