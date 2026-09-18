import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.services.fraud_engine import (
    FraudEngine,
    LargeAmountRule,
    OddHoursRule,
    TransferContext,
)


@pytest.mark.asyncio
async def test_large_amount_rule():
    rule = LargeAmountRule(threshold_pence=100000)  # £1,000 threshold
    
    # 1. Under threshold
    ctx_pass = TransferContext(
        sender_account_id=uuid.uuid4(),
        receiver_account_id=uuid.uuid4(),
        amount=50000,
        currency="GBP",
    )
    res_pass = await rule.evaluate(ctx_pass, db=None)
    assert res_pass.passed is True
    assert res_pass.action == "ALLOW"

    # 2. Over threshold
    ctx_fail = TransferContext(
        sender_account_id=uuid.uuid4(),
        receiver_account_id=uuid.uuid4(),
        amount=150000,
        currency="GBP",
    )
    res_fail = await rule.evaluate(ctx_fail, db=None)
    assert res_fail.passed is False
    assert res_fail.action == "FLAG"
    assert "exceeds threshold" in res_fail.reason


@pytest.mark.asyncio
async def test_odd_hours_rule():
    rule = OddHoursRule(start_hour=1, end_hour=5)

    # 1. Normal hour: 14:00 UTC
    normal_time = datetime(2026, 9, 18, 14, 30, tzinfo=UTC)
    ctx_normal = TransferContext(
        sender_account_id=uuid.uuid4(),
        receiver_account_id=uuid.uuid4(),
        amount=1000,
        currency="GBP",
        timestamp=normal_time,
    )
    res_normal = await rule.evaluate(ctx_normal, db=None)
    assert res_normal.passed is True

    # 2. Odd hour: 03:00 UTC
    odd_time = datetime(2026, 9, 18, 3, 15, tzinfo=UTC)
    ctx_odd = TransferContext(
        sender_account_id=uuid.uuid4(),
        receiver_account_id=uuid.uuid4(),
        amount=1000,
        currency="GBP",
        timestamp=odd_time,
    )
    res_odd = await rule.evaluate(ctx_odd, db=None)
    assert res_odd.passed is False
    assert "restricted risk window" in res_odd.reason


@pytest.mark.asyncio
async def test_fraud_engine_orchestration():
    mock_db = AsyncMock()
    
    # Configure mock db to return count=1 for velocity
    mock_execute = AsyncMock()
    mock_execute.scalar.return_value = 1
    mock_db.execute.return_value = mock_execute

    engine = FraudEngine(rules=[
        LargeAmountRule(threshold_pence=50000),
        OddHoursRule(start_hour=1, end_hour=5),
    ])

    # Transfer with large amount at daytime (10:00 UTC)
    ctx = TransferContext(
        sender_account_id=uuid.uuid4(),
        receiver_account_id=uuid.uuid4(),
        amount=75000,
        currency="GBP",
        timestamp=datetime(2026, 9, 18, 10, 0, tzinfo=UTC),
    )

    evaluation = await engine.evaluate_transfer(ctx, mock_db)
    assert evaluation.is_flagged is True
    assert evaluation.is_blocked is False
    assert len(evaluation.reasons) == 1
    assert "LARGE_AMOUNT_CHECK" in evaluation.reasons[0]
