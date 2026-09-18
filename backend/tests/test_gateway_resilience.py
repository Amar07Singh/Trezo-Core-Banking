from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.core.errors import GatewayException
from app.services.gateway_client import MockPaymentGatewayClient


@pytest.mark.asyncio
async def test_gateway_successful_clearance():
    client = MockPaymentGatewayClient(base_url="http://mock-gateway:8001")
    
    mock_resp_data = {
        "status": "CLEARED",
        "clearance_id": "CLR-12345",
        "original_reference": "TRF-TEST-01",
        "amount": 5000,
        "currency": "GBP",
        "cleared_at": "2026-09-18T12:00:00Z"
    }

    with patch.object(client, "_execute_request", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = mock_resp_data
        result = await client.verify_and_clear_external_settlement(
            transfer_reference="TRF-TEST-01",
            amount_pence=5000,
            currency="GBP",
            destination_account="ACT-GB9999",
        )
        assert result["status"] == "CLEARED"
        assert result["clearance_id"] == "CLR-12345"


@pytest.mark.asyncio
async def test_gateway_failure_raises_gateway_exception():
    client = MockPaymentGatewayClient(base_url="http://mock-gateway:8001")

    with patch.object(client, "_execute_request", new_callable=AsyncMock) as mock_exec:
        mock_exec.side_effect = httpx.RequestError("Connection refused to clearing gateway")
        
        with pytest.raises(GatewayException) as exc_info:
            await client.verify_and_clear_external_settlement(
                transfer_reference="TRF-FAIL-01",
                amount_pence=5000,
                currency="GBP",
                destination_account="ACT-GB9999",
            )
        assert "Settlement clearance failed" in str(exc_info.value)
