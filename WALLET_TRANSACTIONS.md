# Wallet Transactions Read Model

## Overview

The `wallet_transactions` table is the **read model** for money movement. It gives customers and staff a unified, queryable transaction history. It is NOT the Ledger (Phase 5) — the Ledger will be the authoritative financial record. This read model is eventually consistent with Safe Haven, not with the Ledger yet.

## Schema Reference

### `wallet_transactions` table

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `transaction_reference` | text | Our internal reference (WTX-YYYY-NNNNNNNN) |
| `external_reference` | text | Safe Haven's transaction/session ID |
| `wallet_id` | uuid | FK to wallets table |
| `direction` | enum | `credit` (money in) or `debit` (money out) |
| `amount` | numeric(15,2) | Transaction amount (always positive) |
| `currency` | text | Default 'NGN' |
| `transaction_type` | enum | deposit, transfer_in, transfer_out, withdrawal, fee, interest, penalty, loan_disbursement, loan_repayment, reversal, adjustment, unknown |
| `narration` | text | Transaction narration/description |
| `source` | enum | safe_haven_webhook, internal_operation, reconciliation_adjustment, system_initialization |
| `source_event_id` | uuid | FK to inbound_events (Phase 2 landing table) |
| `internal_reference` | text | Reference to internal operation (e.g., FTO ID in Phase 5) |
| `counterparty_*` | text | Counterparty account info (for transfers) |
| `status` | enum | pending, confirmed, failed, reversed |
| `pending_at` | timestamptz | When the transaction was initiated |
| `confirmed_at` | timestamptz | When Safe Haven confirmed |
| `failed_at` | timestamptz | When the transaction failed |
| `failure_reason` | text | Reason for failure |
| `reversal_of` | uuid | If this is a reversal, points to the original transaction |
| `reversed_by` | uuid | If this was reversed, points to the reversal transaction |
| `metadata` | jsonb | Additional data |
| `correlation_id` | uuid | Tracing correlation ID |

## Transaction Status Lifecycle

```
                         ┌───────────┐
                         │  pending  │ ← outbound ops initiated but not yet confirmed
                         └─────┬─────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              │
          ┌──────────┐  ┌──────────┐         │
          │confirmed │  │  failed  │         │
          └────┬─────┘  └──────────┘         │
               │                             │
               ▼                             │
         ┌──────────┐                        │
         │ reversed │ ← NEW reversal row     │
         └──────────┘   references original  │
```

### Status Definitions

| Status | Meaning | Balance Impact |
|---|---|---|
| `pending` | Initiated, awaiting Safe Haven confirmation | NOT included in balance calculation |
| `confirmed` | Safe Haven confirmed the transaction | Included in balance (credits add, debits subtract) |
| `failed` | Transaction failed, no money moved | NOT included in balance |
| `reversed` | A reversal transaction was created referencing this one | Original stays confirmed; reversal is a separate confirmed row in opposite direction |

### Key Rules
- **Append-only:** Rows are never deleted or modified (except status transitions and updated_at)
- **One transaction per inbound event:** Unique index on `source_event_id` prevents duplicate processing
- **Reversals create new rows:** The original transaction is NEVER modified. A reversal creates a new row with `reversal_of` pointing to the original and `direction` reversed.
- **Only confirmed transactions affect balance:** Pending and failed transactions are excluded from balance calculation.

## Balance Cache Authority

**Primary source: Sum of confirmed transactions (credits - debits)**

### Why not Safe Haven's reported balance?
1. **Internally consistent:** We can explain why the balance is what it is from our own records
2. **Prepares for Phase 5 Ledger:** The Ledger will be the authoritative source, and it's also sum-based
3. **External truth ≠ displayed truth:** Safe Haven's balance may include charges or adjustments we don't know about. We display our computed balance and reconcile against Safe Haven separately.
4. **Audit trail:** Every balance change is traceable to a specific confirmed transaction

### How it's updated
The `refresh_wallet_balance_cache()` SQL function is the ONLY sanctioned way to update the balance:
```sql
SELECT refresh_wallet_balance_cache('wallet-uuid');
```
This function:
1. Sums all confirmed credits and debits for the wallet
2. Subtracts the reserved balance to get available balance
3. Updates `cached_balance`, `cached_available_balance`, `cached_ledger_balance`
4. Increments `version` (optimistic concurrency)

Called ONLY from:
- The event processor (after creating a new confirmed transaction)
- The reconciliation process (only after manual flag resolution — never auto-correct)
- Phase 5 Orchestrator (future)

## Event Processing Pipeline

```
inbound_events (received)
    ↓ processEventBatch()
    ↓ For each event:
    │
    ├─ 1. Parse raw_payload (account_number, amount, direction, etc.)
    ├─ 2. Match to wallet by account_number
    ├─ 3. Check for duplicate (unique on source_event_id)
    ├─ 4. Create wallet_transactions row (status=confirmed)
    ├─ 5. Call refresh_wallet_balance_cache()
    ├─ 6. Mark inbound_event as processed
    │
    ↓ If any step fails:
      └─ Mark event as 'failed' with error message
         Increment processing_attempts
         (Event stays in landing table, retriable)
```

### Trigger Mechanisms
- **Cron:** Every 5 minutes via `/api/cron/process-events` (Vercel Cron)
- **Manual:** Admin triggers via GET/POST to the same endpoint
- **Phase 5:** The Orchestrator will take over event processing

### Failure Handling
- Events that fail processing are marked as `failed` in `inbound_events`
- `processing_attempts` is incremented
- `error_message` records the failure reason
- Failed events stay in the landing table and can be retried
- After 3 failed attempts, events should be escalated (Phase 4+ alerting)

## Reconciliation

### Cadence
- **Scheduled:** Daily at 2 AM (Vercel Cron: `/api/cron/reconcile`)
- **On-demand:** Admin triggers via `/api/wallets/[walletId]/reconcile`

### What It Checks
1. **Internal consistency:** `cached_balance` == SUM(confirmed transactions)
   - Catches bugs in the balance cache refresh
2. **External consistency:** Our balance vs Safe Haven's `GET /accounts/{id}` balance
   - Catches missing webhooks, SH-side adjustments, timing issues

### Tolerance
₦1.00 (one naira) — accounts for rounding differences in floating-point calculations.

### Discrepancy Handling
```
If |our_balance - sh_balance| > ₦1.00:
    → Create reconciliation_flag (status: open)
    → Do NOT auto-correct
    → Notify compliance/finance staff
    → Human investigates and resolves
```

Flag resolution is manual:
- `matched` — False positive (balances actually matched after investigation)
- `adjusted` — Manual adjustment made (creates adjustment transaction)
- `write_off` — Discrepancy written off with approval
- `escalated` — Escalated to Safe Haven support or senior staff
- `pending_sh` — Waiting for Safe Haven to respond

### `reconciliation_flags` table

| Column | Type | Description |
|---|---|---|
| `wallet_id` | uuid | FK to wallets |
| `our_balance` | numeric(15,2) | Our computed balance at time of check |
| `sh_balance` | numeric(15,2) | Safe Haven's reported balance |
| `discrepancy_amount` | numeric(15,2) | our_balance - sh_balance |
| `discrepancy_direction` | text | positive (we're ahead) or negative (we're behind) |
| `status` | enum | open, investigating, resolved, escalated |
| `resolution_type` | enum | matched, adjusted, write_off, escalated, pending_sh |
| `resolution_notes` | text | Notes from resolver |
| `resolved_by` | uuid | Staff user who resolved |
| `sh_response_snapshot` | jsonb | Full SH response for audit |

## API Endpoints

### Customer-Facing
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/wallets/[walletId]/balance` | GET | Customer (own) or staff (wallet.read) | Get current balance cache |
| `/api/wallets/[walletId]/transactions` | GET | Customer (own) or staff (wallet.read) | Get transaction history (paginated, filterable) |

### Admin-Facing
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/wallets/[walletId]/reconcile` | POST | Staff (wallet.read) | Trigger on-demand reconciliation |
| `/api/admin/reconciliation-flags` | GET | Staff (audit.read) | List reconciliation flags |

### Cron
| Endpoint | Method | Auth | Schedule | Description |
|---|---|---|---|---|
| `/api/cron/process-events` | POST | CRON_SECRET | Every 5 min | Process received inbound events |
| `/api/cron/reconcile` | POST | CRON_SECRET | Daily 2 AM | Run reconciliation on all active wallets |

### Transaction Query Filters
`GET /api/wallets/[walletId]/transactions` supports:
- `page` — Page number (default 1)
- `limit` — Items per page (default 20, max 100)
- `status` — Filter by status (pending/confirmed/failed/reversed)
- `direction` — Filter by direction (credit/debit)
- `from` — Filter by date (ISO, inclusive)
- `to` — Filter by date (ISO, inclusive)

## RBAC

| Permission | Who Has It | What It Allows |
|---|---|---|
| `wallet.read` | super_admin, operations, loan_officer, finance, compliance, customer_support | Read any wallet's balance and transactions |
| Customer (self) | Any authenticated customer | Read own wallet's balance and transactions (RLS enforced) |
| `audit.read` | super_admin, compliance, finance | View reconciliation flags |
| `compliance.update` | super_admin, compliance | Investigate and resolve reconciliation flags |

## What Phase 3 Is NOT

- ❌ The Ledger (Phase 5)
- ❌ The Orchestrator/FTO (Phase 5)
- ❌ Interest calculations
- ❌ Fees or penalties
- ❌ Loan disbursement/repayment logic
- ❌ Savings product rules
- ❌ Double-entry accounting
- ❌ Auto-correction of balance discrepancies

## What Changes in Phase 5

When the Ledger and Orchestrator arrive:
1. **Balance authority shifts:** `cached_balance` will be derived from Ledger entries, not from sum of `wallet_transactions`. The `refresh_wallet_balance_cache()` function will be updated to read from the Ledger.
2. **Transaction creation:** The Orchestrator (FTO) will create `wallet_transactions` rows as part of its lifecycle, not just the event processor.
3. **Reconciliation:** Will compare against the Ledger, not just Safe Haven. Safe Haven reconciliation becomes a secondary check.
4. **Double-entry:** Each `wallet_transactions` row will have a corresponding pair of Ledger entries (debit/credit to specific accounts).
5. **The read model stays:** `wallet_transactions` remains the read model for customer-facing UI. But its source of truth becomes the Ledger, not Safe Haven webhooks.
