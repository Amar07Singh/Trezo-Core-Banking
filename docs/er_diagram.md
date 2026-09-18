# Entity-Relationship (ER) Diagram & Schema Specification

```mermaid
erDiagram
    USERS ||--o{ ACCOUNTS : owns
    USERS ||--o{ IDEMPOTENCY_KEYS : initiates
    USERS ||--o{ AUDIT_LOGS : triggers
    ACCOUNTS ||--o{ LEDGER_ENTRIES : contains
    ACCOUNTS ||--o{ TRANSFERS : sends
    ACCOUNTS ||--o{ TRANSFERS : receives
    JOURNAL_ENTRIES ||--|{ LEDGER_ENTRIES : groups
    JOURNAL_ENTRIES ||--o| TRANSFERS : clears

    USERS {
        uuid id PK
        string email UK
        string hashed_password
        string full_name
        string role "CUSTOMER | ADMIN"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    ACCOUNTS {
        uuid id PK
        string account_number UK
        uuid user_id FK
        string currency "GBP | USD | EUR"
        bigint balance "CHECK balance >= 0"
        string status "ACTIVE | FROZEN | CLOSED"
        timestamp created_at
        timestamp updated_at
    }

    JOURNAL_ENTRIES {
        uuid id PK
        string reference UK
        text narration
        timestamp created_at
    }

    LEDGER_ENTRIES {
        uuid id PK
        uuid journal_id FK
        uuid account_id FK
        string entry_type "DEBIT | CREDIT"
        bigint amount "CHECK amount > 0"
        bigint balance_after
        timestamp created_at
    }

    TRANSFERS {
        uuid id PK
        uuid sender_account_id FK
        uuid receiver_account_id FK
        bigint amount "CHECK amount > 0"
        string currency
        string status "PENDING | COMPLETED | FAILED | FLAGGED"
        string reference UK
        json fraud_flags
        uuid journal_id FK
        timestamp created_at
        timestamp updated_at
    }

    IDEMPOTENCY_KEYS {
        string key PK
        uuid user_id FK
        string request_path
        string request_hash
        int status_code
        json response_headers
        text response_body
        timestamp created_at
        timestamp expires_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        string action
        string resource_type
        string resource_id
        json before_state
        json after_state
        string ip_address
        timestamp created_at
    }

    OUTBOX_EVENTS {
        uuid id PK
        string event_type
        string aggregate_id
        json payload
        string status "PENDING | PROCESSING | PROCESSED | FAILED"
        int retry_count
        text error_message
        timestamp created_at
        timestamp processed_at
    }
```

## Schema Constraints & Invariants:
1. **CHECK `accounts.balance >= 0`**: Prevents unauthorized overdrafts at the database engine level.
2. **CHECK `ledger_entries.amount > 0`**: Ensures zero or negative ledger entries cannot corrupt bookkeeping.
3. **CHECK `transfers.amount > 0`**: Guarantees transfer values are strictly positive.
4. **UNIQUE `accounts.account_number`**: Guarantees unique bank account identification.
5. **UNIQUE `idempotency_keys.key`**: Prevents duplicate transaction execution by key replay.
6. **Append-Only `audit_logs`**: Logs are strictly inserted, never mutated or deleted.
