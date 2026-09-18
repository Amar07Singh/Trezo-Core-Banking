## 1. What Exactly in the Backend is Running, Ready, and Fit

Every single architectural requirement is fully developed, tested, and actively running in the cluster:

1. **Python 3.12 + FastAPI Async Engine**:
   - Modern asynchronous web API with dependency injection (`Depends`), Pydantic v2 data validation, and automated OpenAPI documentation (`/docs`, `/redoc`, `/openapi.json`).
2. **Single Source of Truth Datastore (PostgreSQL 16 Only — Strictly NO Redis)**:
   - All state, locks, idempotency entries, ledger legs, and outbox queues reside in PostgreSQL. In-process TTL caches (`cachetools`) are utilized for non-critical reads, eliminating external cache synchronization risks.
3. **Double-Entry Ledger Domain Model**:
   - Strict double-entry accounting where every transaction creates a parent `JournalEntry` and balanced `DEBIT` and `CREDIT` `LedgerEntry` records in 64-bit integer minor units (pence).
   - Enforces the universal invariant: $\sum \text{Debits} = \sum \text{Credits}$ ($\Delta \text{System Balance} = 0$).
   - Database-level `CheckConstraint('balance >= 0')` guarantees negative balances and unbacked overdrafts are physically rejected by PostgreSQL.
4. **Deadlock-Free ACID Transfers (`SELECT ... FOR UPDATE`)**:
   - Enforces deterministic ascending UUID lock ordering (`min(id1, id2)` then `max(id1, id2)`) with `populate_existing=True`.
   - Circular lock wait graphs cannot form across concurrent workers, mathematically eliminating database deadlocks.
5. **Replayable Idempotency Keys**:
   - `Idempotency-Key` header with database-backed deduplication table (`idempotency_keys`).
   - Retrying the same transaction returns the cached response with `X-Cache-Lookup: HIT` without double debiting the customer's account.
   - Payload tampering with a reused key raises an RFC 7807 `409 Conflict`.
6. **Pluggable Strategy-Pattern Fraud & Risk Engine**:
   - Object-oriented strategy orchestrator with extensible `FraudRule` base classes:
     - `LargeAmountRule`: Detects and flags transfers exceeding configurable thresholds (e.g. > £10,000).
     - `RapidRepeatVelocityRule`: Executes an indexed PostgreSQL query counting transactions in the last $N$ seconds (e.g. > 3 in 60s) to detect velocity bursts.
     - `OddHoursRule`: Flags transfers initiated during high-risk overnight hours (01:00 - 05:00 UTC).
7. **Append-Only Audit Logging**:
   - Immutable `audit_logs` table written via a dedicated service layer recording who, what, when, IP address, and verified state diffs for all financial and administrative actions.
8. **Transactional Outbox Worker**:
   - Outbox events (`outbox_events`) are committed atomically in the same database transaction as the fund transfer (eliminating dual-write data loss).
   - The worker daemon polls pending events using `SELECT ... FOR UPDATE SKIP LOCKED`, allowing multiple concurrent workers to scale horizontally with zero lock contention.
9. **Resilient Mock Payment Gateway Service**:
   - Standalone FastAPI microservice on port `8001` simulating external inter-bank clearing networks (Faster Payments / BACS).
   - Integrated with HTTP timeouts, exponential backoff retries via `tenacity`, and circuit breaker protection (`pybreaker`).
10. **Role-Based Access Control (RBAC) & Security**:
    - Stateless JWT authentication (PyJWT) with expiration and bcrypt password hashing.
    - Role guards distinguishing between `CUSTOMER` accounts and `ADMIN` operations.
11. **High-Availability Clustering & Load Balancing**:
    - Dual backend replicas (`api-node-01` and `api-node-02`) running behind Nginx.
    - Round-robin load distribution with automated failover.
12. **Standardized RFC 7807 Error Handling**:
    - Machine-readable error payloads (`application/problem+json`) with standard `type`, `title`, `status`, `detail`, and `instance` fields.
13. **Observability & Correlation IDs**:
    - `CorrelationIdMiddleware` assigns or propagates `X-Correlation-ID` across all requests and structured JSON logs.
14. **Health & Readiness Probes**:
    - `/health` endpoint for process liveness.
    - `/ready` endpoint verifying database pool connectivity.
15. **Automated Alembic Migrations & Database Seeding**:
    - Alembic async migrations establish full schema DDL on startup.
    - Automatic seeding script creates initial users, accounts, and balanced journal entries.
16. **High-Concurrency Safety**:
    - Validated by an automated test firing **50 simultaneous parallel cross-transfers** with `asyncio.gather` — completing with 0 deadlocks and exact mathematical conservation of total balance.

---


In Docker, 6 services in total.
- `banking_postgres`: PostgreSQL 16 database (healthy on port 5432)
- `mock_payment_gateway`: External clearing simulator (port 8001)
- `banking_api_1`: Backend API replica 1 (`api-node-01`)
- `banking_api_2`: Backend API replica 2 (`api-node-02`)
- `banking_outbox_worker`: Transactional outbox polling daemon
- `banking_load_balancer`: Nginx reverse proxy & frontend web server (port 8000)