# Financial Risk Log & Threat Model

| Risk ID | Threat Scenario | Impact | Mitigation Strategy | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-001** | **Deadlock on Concurrent Cross-Transfers** (A->B and B->A simultaneously) | High (Transaction failure, DB lock contention) | Deterministic lock ordering: always lock `min(acc1, acc2)` before `max(acc1, acc2)`. | `tests/test_concurrency.py` (50 parallel simultaneous transfers). |
| **RSK-002** | **Double-Spend / Negative Balance Race** | Critical (Unbacked money created, overdraft) | `SELECT ... FOR UPDATE` row locks combined with PostgreSQL `CHECK (balance >= 0)`. | Database check constraint and transfer service balance checks. |
| **RSK-003** | **Network Retry Double-Debit** | High (Customer charged twice on network glitch) | Mandatory `Idempotency-Key` header stored with unique constraint and response replay. | `tests/test_idempotency.py`. |
| **RSK-004** | **Fraudulent Velocity Bursts / Account Takeover** | High (Rapid unauthorized draining of funds) | Pluggable Strategy pattern (`RapidRepeatVelocityRule`, `LargeAmountRule`, `OddHoursRule`). | `tests/test_fraud_rules.py`. |
| **RSK-005** | **External Payment Gateway Outage** | Medium (API cascade failure, thread exhaustion) | Httpx timeouts, exponential backoff retries via Tenacity, and Circuit Breaker pattern. | `tests/test_gateway_resilience.py`. |
| **RSK-006** | **Dual-Write Data Loss** | High (Transfer succeeds in DB, notification lost) | Transactional Outbox pattern: outbox event written in same DB transaction with `FOR UPDATE SKIP LOCKED`. | `tests/test_outbox.py`. |
| **RSK-007** | **Unauthorized Admin Operation** | Critical (Internal privilege escalation) | RBAC guards (`require_admin` dependency) and append-only audit logging of all actions. | `tests/test_auth.py`. |
