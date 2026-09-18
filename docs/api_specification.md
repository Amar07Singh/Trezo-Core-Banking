# Core Banking API Specification

Base URL: `/api/v1`

## Authentication & RBAC
- `POST /api/v1/auth/register`: Create a new user (`CUSTOMER` or `ADMIN`).
- `POST /api/v1/auth/login`: Form-encoded OAuth2 login returning JWT bearer token.
- `GET /api/v1/auth/me`: Inspect authenticated user credentials.

## Account Management
- `POST /api/v1/accounts`: Create an account (`currency: "GBP"`, `initial_deposit: 100000`).
- `GET /api/v1/accounts`: List all accounts belonging to the authenticated customer.
- `GET /api/v1/accounts/{account_number}`: Retrieve account metadata and status.
- `GET /api/v1/accounts/{account_number}/balance`: Retrieve live balance.

## Fund Transfers & Idempotency
- `POST /api/v1/transfers`: Execute ACID fund transfer.
  - Header: `Idempotency-Key: <unique-uuid-or-string>` (Required for replay protection).
  - Body:
    ```json
    {
      "sender_account_number": "ACT-GB1001",
      "receiver_account_number": "ACT-GB1002",
      "amount": 25000,
      "currency": "GBP",
      "reference": "RENT-SEP-2026",
      "narration": "Monthly Apartment Rent"
    }
    ```
  - Responses:
    - `201 Created`: Transfer successfully completed (`X-Cache-Lookup: MISS`).
    - `201 Created`: Replayed from cache (`X-Cache-Lookup: HIT`).
    - `403 Forbidden`: Blocked by fraud rules or account inactive.
    - `409 Conflict`: Idempotency key reused with different payload.
    - `422 Unprocessable`: Insufficient funds.

## Statements & Double-Entry Ledger
- `GET /api/v1/accounts/{account_number}/statement?page=1&page_size=20`:
  - Returns paginated list of ledger entries with narration, reference, debit/credit leg, and `balance_after`.

## Administrative Operations
- `GET /api/v1/admin/audit-logs`: Append-only audit events log.
- `GET /api/v1/admin/transfers/flagged`: Transfers flagged by the risk engine.
- `PATCH /api/v1/admin/accounts/{account_number}/status`: Freeze or unfreeze an account.
- `GET /api/v1/admin/outbox`: Inspect transactional outbox queues.
- `GET /api/v1/admin/stats`: Aggregate system metrics.

## RFC 7807 Problem Details
All error responses adhere strictly to RFC 7807:
```json
{
  "type": "https://errors.bank.natwest.com/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Account ACT-GB1001 has balance 500 minor units, but 10000 was requested.",
  "instance": "/api/v1/transfers",
  "correlation_id": "78284518-e376-46c5-a6bf-8547464619b0",
  "account_number": "ACT-GB1001",
  "current_balance": 500,
  "requested_amount": 10000
}
```
