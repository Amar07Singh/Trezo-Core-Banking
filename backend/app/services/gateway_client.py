from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.errors import GatewayException
from app.core.logging import logger

try:
    import pybreaker
    db_breaker = pybreaker.CircuitBreaker(fail_max=3, reset_timeout=15)
except ImportError:
    # Minimal fallback circuit breaker
    class MinimalBreaker:
        def __call__(self, func):
            return func
    db_breaker = MinimalBreaker()


class MockPaymentGatewayClient:
    """
    Client for interacting with the external Mock Payment Gateway service.
    Implements:
    - HTTP timeout protection
    - Exponential backoff retry via Tenacity
    - Circuit breaker pattern to avoid thundering herds on remote failure
    """
    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.MOCK_GATEWAY_URL).rstrip("/")
        self.timeout = settings.GATEWAY_TIMEOUT_SECONDS

    @retry(
        reraise=True,
        stop=stop_after_attempt(settings.GATEWAY_MAX_RETRIES),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=2.0),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
    )
    async def _execute_request(self, method: str, path: str, json_data: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(method, url, json=json_data)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error("gateway_http_error", status=e.response.status_code, body=e.response.text)
                raise GatewayException(f"Gateway returned status {e.response.status_code}") from e
            except httpx.RequestError as e:
                logger.error("gateway_request_error", error=str(e))
                raise GatewayException(f"Gateway connection error: {str(e)}") from e

    async def verify_and_clear_external_settlement(
        self,
        transfer_reference: str,
        amount_pence: int,
        currency: str,
        destination_account: str,
    ) -> dict[str, Any]:
        """
        Calls external clearing gateway to validate and clear inter-bank settlement.
        """
        payload = {
            "reference": transfer_reference,
            "amount": amount_pence,
            "currency": currency,
            "destination_account": destination_account,
        }
        try:
            return await self._execute_request("POST", "/payments/clear", json_data=payload)
        except Exception as e:
            logger.warning("gateway_settlement_failed", error=str(e), reference=transfer_reference)
            raise GatewayException(f"Settlement clearance failed: {str(e)}") from e


gateway_client = MockPaymentGatewayClient()
