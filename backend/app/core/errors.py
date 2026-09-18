from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_correlation_id


class BankingException(Exception):
    def __init__(
        self,
        title: str,
        detail: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        type_uri: str = "https://errors.bank.natwest.com/general-error",
        invalid_params: list[dict[str, Any]] | None = None,
        extra: dict[str, Any] | None = None,
    ):
        self.title = title
        self.detail = detail
        self.status_code = status_code
        self.type_uri = type_uri
        self.invalid_params = invalid_params
        self.extra = extra or {}
        super().__init__(detail)


class InsufficientFundsException(BankingException):
    def __init__(self, account_number: str, current_balance: int, requested_amount: int):
        super().__init__(
            title="Insufficient Funds",
            detail=f"Account {account_number} has balance {current_balance} minor units, but {requested_amount} was requested.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            type_uri="https://errors.bank.natwest.com/insufficient-funds",
            extra={"account_number": account_number, "current_balance": current_balance, "requested_amount": requested_amount}
        )


class AccountNotFoundException(BankingException):
    def __init__(self, identifier: str):
        super().__init__(
            title="Account Not Found",
            detail=f"Account '{identifier}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            type_uri="https://errors.bank.natwest.com/account-not-found"
        )


class AccountInactiveException(BankingException):
    def __init__(self, account_number: str, current_state: str):
        super().__init__(
            title="Account Inactive",
            detail=f"Account '{account_number}' cannot process transactions because it is in '{current_state}' status.",
            status_code=status.HTTP_403_FORBIDDEN,
            type_uri="https://errors.bank.natwest.com/account-inactive"
        )


class SameAccountTransferException(BankingException):
    def __init__(self):
        super().__init__(
            title="Invalid Transfer",
            detail="Source and destination accounts must be different.",
            status_code=status.HTTP_400_BAD_REQUEST,
            type_uri="https://errors.bank.natwest.com/same-account-transfer"
        )


class InvalidCurrencyException(BankingException):
    def __init__(self, expected: str, actual: str):
        super().__init__(
            title="Currency Mismatch",
            detail=f"Account currency '{expected}' does not match transfer currency '{actual}'.",
            status_code=status.HTTP_400_BAD_REQUEST,
            type_uri="https://errors.bank.natwest.com/currency-mismatch"
        )


class FraudBlockedException(BankingException):
    def __init__(self, reasons: list[str]):
        super().__init__(
            title="Transaction Blocked by Fraud Rule Engine",
            detail="The transfer triggered security/risk controls and was rejected.",
            status_code=status.HTTP_403_FORBIDDEN,
            type_uri="https://errors.bank.natwest.com/fraud-blocked",
            extra={"flags": reasons}
        )


class IdempotencyConflictException(BankingException):
    def __init__(self, key: str, detail: str = "A request with this Idempotency-Key is currently processing or payload mismatch."):
        super().__init__(
            title="Idempotency Conflict",
            detail=detail,
            status_code=status.HTTP_409_CONFLICT,
            type_uri="https://errors.bank.natwest.com/idempotency-conflict",
            extra={"idempotency_key": key}
        )


class GatewayException(BankingException):
    def __init__(self, message: str):
        super().__init__(
            title="Payment Gateway Failure",
            detail=f"External gateway error: {message}",
            status_code=status.HTTP_502_BAD_GATEWAY,
            type_uri="https://errors.bank.natwest.com/gateway-failure"
        )


def make_rfc7807_response(
    request: Request,
    status_code: int,
    title: str,
    detail: str,
    type_uri: str,
    invalid_params: list[dict[str, Any]] | None = None,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    correlation_id = get_correlation_id()
    body = {
        "type": type_uri,
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": str(request.url.path),
        "correlation_id": correlation_id,
    }
    if invalid_params:
        body["invalid_params"] = invalid_params
    if extra:
        body.update(extra)

    headers = {"Content-Type": "application/problem+json"}
    if correlation_id:
        headers["X-Correlation-ID"] = correlation_id

    return JSONResponse(status_code=status_code, content=body, headers=headers)


async def banking_exception_handler(request: Request, exc: BankingException) -> JSONResponse:
    return make_rfc7807_response(
        request=request,
        status_code=exc.status_code,
        title=exc.title,
        detail=exc.detail,
        type_uri=exc.type_uri,
        invalid_params=exc.invalid_params,
        extra=exc.extra,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = []
    for err in exc.errors():
        errors.append({
            "loc": err.get("loc"),
            "msg": err.get("msg"),
            "type": err.get("type"),
        })
    return make_rfc7807_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        title="Request Validation Error",
        detail="The request body or parameters failed validation schema.",
        type_uri="https://errors.bank.natwest.com/validation-error",
        invalid_params=errors,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return make_rfc7807_response(
        request=request,
        status_code=exc.status_code,
        title="HTTP Error",
        detail=str(exc.detail),
        type_uri=f"https://errors.bank.natwest.com/http-{exc.status_code}",
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return make_rfc7807_response(
        request=request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        title="Internal Server Error",
        detail="An unexpected internal error occurred on the server.",
        type_uri="https://errors.bank.natwest.com/internal-error",
    )
