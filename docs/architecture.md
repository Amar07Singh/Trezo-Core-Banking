# Architecture & Technical Design Document

## 1. System Overview
The **NatWest Core Banking Platform** is an enterprise-grade, ACID-compliant banking backend designed for high-concurrency fund transfers, ledger integrity, idempotency, and fraud mitigation.

It is built with:
- **FastAPI (Python 3.12)**: Asynchronous web framework with automatic OpenAPI documentation.
- **SQLAlchemy 2.0 (Async) + PostgreSQL 16**: PostgreSQL is the single source of truth (no Redis).
- **Deadlock-Free Locking**: `SELECT ... FOR UPDATE` with deterministic lock ordering (`min(id_1, id_2)` then `max(id_1, id_2)`).
- **Double-Entry Ledger**: Strict accounting invariant where every transaction records balancing debit and credit legs in integer minor units (pence).
- **Transactional Outbox Worker**: Event-driven asynchronous notifications using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **Fraud Detection Engine**: Pluggable Strategy pattern (`FraudRule` base class) with configurable velocity checks, large amount guards, and odd hours filtering.
- **Resilient Mock Gateway**: External settlement gateway integrated via `httpx`, `tenacity` retry with exponential backoff, and circuit breaking (`pybreaker`).
- **High-Availability Clustering**: Multiple API replicas behind an Nginx reverse proxy with `X-Served-By` tracking.

---

## 2. Component Diagram

```
                              [ Client / Frontend ]
                                        │
                                        ▼
                     [ Nginx Reverse Proxy / Load Balancer ]
                                   (:8000)
                                  /       \
                                 /         \
                                ▼           ▼
                      [ Banking API 1 ]   [ Banking API 2 ]
                           (:8000)             (:8000)
                                 \             /
                                  \           /
                                   ▼         ▼
                            [ PostgreSQL 16 ]
                           (Single Data Store)
                            ├── users
                            ├── accounts (CHECK balance >= 0)
                            ├── journal_entries
                            ├── ledger_entries
                            ├── transfers
                            ├── idempotency_keys
                            ├── audit_logs (append-only)
                            └── outbox_events
                                   ▲
                                   │ (FOR UPDATE SKIP LOCKED)
                                   │
                         [ Outbox Worker Container ]
                                   │
                                   ▼
                         [ Mock Payment Gateway ]
                                   (:8001)
```

---

## 3. Financial Invariants & Concurrency Safety

### 3.1 Integer Minor Units
All monetary amounts are represented as 64-bit integers (`BIGINT`) representing minor currency units (e.g. 1000 pence = £10.00). Floating-point roundoff errors are physically impossible.

### 3.2 Double-Entry Bookkeeping
For every financial transfer:
1. Exactly one `JournalEntry` is created as the parent transaction record.
2. Two `LedgerEntry` records are created:
   - Leg 1: `EntryType.DEBIT` for the sender's account.
   - Leg 2: `EntryType.CREDIT` for the receiver's account.
3. System Invariant:
   $$\sum \text{Debit Amounts} = \sum \text{Credit Amounts}$$
   $$\Delta \text{System Total Balance} = 0$$

### 3.3 Deadlock Elimination
Concurrent bidirectional transfers between two accounts (e.g. Account A sending to Account B while Account B sends to Account A) can cause database deadlocks if accounts are locked in arbitrary order.

**Deterministic Ordering Algorithm**:
```python
id_1, id_2 = sorted([sender.id, receiver.id])
# Always lock id_1 first, then id_2
acc_1 = await db.execute(select(Account).where(Account.id == id_1).with_for_update())
acc_2 = await db.execute(select(Account).where(Account.id == id_2).with_for_update())
```
Because every transaction attempts to acquire locks in the exact same resource sequence, cyclic dependency graphs cannot form, mathematically guaranteeing zero deadlocks.

---

## 4. Transactional Outbox Pattern
Instead of dual-writing to an external broker and database (which risks split-brain failure during network partitions), outbound notification messages are inserted into the `outbox_events` table inside the exact same database transaction as the fund transfer.

The background `outbox_worker` processes events asynchronously:
```sql
SELECT * FROM outbox_events
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;
```
`SKIP LOCKED` allows multiple concurrent worker instances to scale out horizontally without waiting or conflicting with each other.
