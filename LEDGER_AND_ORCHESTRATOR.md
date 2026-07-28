# Ledger & Financial Transaction Orchestrator (FTO)

## Overview

The Ledger is the **single source of financial truth**. The Orchestrator is the **only entry point** for financial movements. Together, they form the accounting backbone of the platform.

**Key principle:** At any point, "why does this customer have this balance?" must be answerable by replaying immutable ledger entries — never by trusting a cached number.

---

## Architecture

```
Calling Module (Wallet, Savings, Loans, Investments)
    ↓ FinancialTransactionRequest
Orchestrator (FTO)
    ↓ Validates → Sequences → Posts
Ledger Domain
    ↓ journal_entries + journal_lines (immutable, zero-sum)
    ↓
Account Balances (computed from journal lines)
    ↓
Wallet Balance Cache (refreshed from ledger, never written directly)
```

**Module separation:**
- `/src/modules/ledger/` — Chart of accounts, journal entries, journal lines, posting, reversal
- `/src/modules/orchestrator/` — Transaction state machine, calling contract, validation, posting coordination

The Orchestrator depends on the Ledger. No other module touches either directly.

---

## Chart of Accounts

| Code | Type | Name | Purpose |
|---|---|---|---|
| 1000 | Asset | Safe Haven Settlement | Cash held at Safe Haven MFB |
| 1001 | Asset | Safe Haven Suspense | Pending/unconfirmed transactions |
| 2000 | Liability | Customer Wallet Accounts (Parent) | Parent for per-wallet accounts |
| 2001 | Liability | Savings Holding Accounts (Parent) | Phase 5+ |
| 2002 | Liability | Loan Settlement Accounts (Parent) | Phase 6+ |
| 2003 | Liability | Investment Settlement Accounts (Parent) | Phase 7+ |
| 2004 | Liability | Escrow Accounts (Parent) | Future |
| 3000 | Equity | Owners Equity | Future |
| 3001 | Equity | Retained Earnings | Future |
| 4000 | Revenue | Fee Revenue | Fee income |
| 4001 | Revenue | Interest Revenue | Loan interest income |
| 5000 | Expense | Interest Expense | Interest paid to savers |
| 5001 | Expense | Operational Expense | Platform operational costs |

Each wallet gets a child account under 2000 with code `2000.{wallet_number}`. The account is created automatically by a trigger when the wallet status transitions to `active`.

### Accounting Model

From the platform's perspective:
- **Customer wallet = liability** (the platform owes the customer)
- **Safe Haven settlement = asset** (cash held externally)

A deposit credits the wallet (liability increases) and debits Safe Haven (asset increases). A withdrawal does the opposite.

---

## Zero-Sum Enforcement (DB-Level)

The zero-sum invariant is enforced at the **database level**, not just the application layer:

1. **`post_journal_entry(entry_id)` function:** Validates that SUM(debits) = SUM(credits) before transitioning the entry from `draft` to `posted`. If they don't match, it raises an exception and the entry stays as `draft`.

2. **Immutability trigger on `journal_lines`:** A BEFORE UPDATE/DELETE trigger raises an exception — journal lines are INSERT-only, forever.

3. **Draft-only insertion trigger:** A BEFORE INSERT trigger on `journal_lines` checks that the parent entry is in `draft` status. Lines cannot be added to posted entries.

4. **Status transition trigger on `journal_entries`:** A BEFORE UPDATE trigger enforces that only valid transitions are allowed: `draft → posted`, `posted → reversed`. No other changes to the entry are permitted.

5. **No direct writes from outside the Ledger:** RLS on `journal_entries` and `journal_lines` restricts all writes to the service role (used by the Ledger module's `post_journal_entry` and `reverse_journal_entry` functions).

---

## Orchestrator State Machine

```
initiated → validated → posting → posted → completed
initiated → failed (validation failed — no ledger impact)
posting → failed (posting failed — rare, journal entry stays draft)
completed → reversed (a reversal transaction was created)
```

| State | Meaning | Ledger Impact |
|---|---|---|
| `initiated` | Request received, validation pending | None |
| `validated` | Validation passed, ready to post | None |
| `posting` | Journal entry being created | Draft entry exists (not in balance) |
| `posted` | Journal entry posted to ledger | **Balance changed** |
| `completed` | All side effects done (balance cache, read model) | Balance cache refreshed |
| `failed` | Validation or posting failed | None (draft entry may exist but not posted) |
| `reversed` | A reversal transaction was created | Reversal entry posted (net zero) |

Every state transition is logged with timestamps. The full audit trail is in the `financial_transactions` table.

---

## The Calling Contract

This is the interface that Savings, Loans, and Investments (all future phases) will use to initiate financial movements. **This is the most important artifact of Phase 4.**

### `initiate(request: FinancialTransactionRequest)`

```typescript
interface FinancialTransactionRequest {
  // WHAT to do (semantic, not raw account codes)
  transaction_type: FinancialTransactionType;
  
  // WHO is asking
  source_module: SourceModule;
  source_reference: string;        // Caller's internal reference (e.g., contribution ID)
  
  // HOW MUCH
  amount: number;
  currency: string;                 // Default 'NGN'
  
  // METADATA
  description: string;
  idempotency_key: string;         // Caller-generated, prevents duplicate posting
  wallet_id?: string;             // The wallet involved (if any)
  metadata?: Record<string, unknown>;
}
```

### Supported Transaction Types (Phase 4)

| Type | Debit | Credit | Description |
|---|---|---|---|
| `wallet_deposit` | Safe Haven Settlement (1000) | Customer Wallet (2000.{wallet}) | Inbound transfer to DVA |
| `wallet_withdrawal` | Customer Wallet (2000.{wallet}) | Safe Haven Settlement (1000) | Outbound transfer from DVA |

Future types (Savings, Loans, Investments) will be added by extending the posting templates — **no changes to the Orchestrator core required.**

### `reverse(request: ReversalRequest)`

```typescript
interface ReversalRequest {
  original_transaction_id: string;
  reason: string;
  idempotency_key: string;
}
```

Creates a new reversing journal entry with opposite debits/credits. The original entry is marked as `reversed` (not deleted, not modified). Net balance effect: zero.

### Idempotency

The `idempotency_key` is caller-generated and unique per transaction. If the same key is submitted twice:
- If the first request completed: return the stored result (no duplicate posting)
- If the first request is in progress: return "in progress" (caller should retry)
- If the first request failed: allow retry (delete old key)

This is **distinct from** Phase 2's Safe Haven API-level idempotency. The Orchestrator idempotency prevents duplicate *domain-level* transaction posting, regardless of which caller initiated it.

---

## Reversal Mechanism

Reversals are **always new entries**, never edits to existing ones:

1. Original entry: Debit 5000 / Credit 5000 (status: `posted` → `reversed`)
2. Reversal entry: Credit 5000 / Debit 5000 (status: `posted`)
3. Net effect: 0 (both entries' lines are included in balance calculation)
4. Original entry's lines are NOT modified — immutability preserved
5. Both entries reference each other via `reverses` / `reversed_by`

### Worked Example: Deposit Reversed Due to Chargeback

**Step 1: Original deposit**
```
Financial Transaction: FT-2026-00000001 (wallet_deposit, ₦5,000)
Journal Entry: JE-2026-00000001 (draft → posted)
  Line 1: Debit  Safe Haven Settlement (1000)    ₦5,000
  Line 2: Credit Customer Wallet (2000.WAL-...)  ₦5,000
  
Wallet balance: ₦5,000 (credit balance of liability account)
Safe Haven balance: ₦5,000 (debit balance of asset account)
```

**Step 2: Reversal**
```
Financial Transaction: FT-2026-00000002 (reversal, ₦5,000)
Journal Entry: JE-2026-00000002 (draft → posted, reverses=JE-2026-00000001)
  Line 1: Credit Safe Haven Settlement (1000)    ₦5,000  (opposite of original debit)
  Line 2: Debit  Customer Wallet (2000.WAL-...)  ₦5,000  (opposite of original credit)

Original entry status: posted → reversed
Reversal entry status: posted
```

**Step 3: After reversal**
```
Wallet balance: ₦5,000 (original credit) - ₦5,000 (reversal debit) = ₦0
Safe Haven balance: ₦5,000 (original debit) - ₦5,000 (reversal credit) = ₦0
Everything nets to zero. ✓
```

---

## End-to-End Worked Example: Safe Haven Inbound Transfer

**Scenario:** Customer receives ₦5,000 bank transfer into their DVA.

### 1. Safe Haven webhook arrives
```
POST /api/webhooks/safe-haven
→ Signature verified (HMAC-SHA256)
→ Raw payload stored in inbound_events (status=received)
→ Returns 200 immediately
```

### 2. Event processor picks up the event (every 5 min via cron)
```
processEventBatch()
→ Finds inbound_event with status=received
→ Parses payload: account_number, amount=5000, direction=credit
→ Matches to wallet by account_number
→ Calls Orchestrator.initiate(...)
```

### 3. Orchestrator receives the request
```typescript
await initiate({
  transaction_type: 'wallet_deposit',
  source_module: 'wallet',
  source_reference: event.id,         // inbound_event ID
  amount: 5000,
  currency: 'NGN',
  description: 'Bank transfer received from John Doe',
  idempotency_key: `wallet_deposit:${event.id}`,
  wallet_id: wallet.id,
  metadata: { external_reference: 'SH-txn-12345' }
});
```

### 4. Orchestrator processes the request (step by step)
```
a. Check idempotency: key "wallet_deposit:event-uuid" not found → proceed
b. Create financial_transaction (status=initiated)
   → FT-2026-00000001, amount=5000, type=wallet_deposit
c. Validate: amount > 0 ✓, wallet exists ✓, template exists ✓
   → Status: initiated → validated
d. Get wallet's ledger account: get_wallet_account_id(wallet.id) → account UUID
e. Get Safe Haven settlement account: getAccountByCode('1000') → account UUID
f. Build journal lines using posting template:
   Line 1: Debit  Safe Haven Settlement  ₦5,000
   Line 2: Credit Customer Wallet         ₦5,000
g. Create journal entry (draft): JE-2026-00000001
   → Status: validated → posting
h. Add journal lines to the draft entry
i. Post journal entry: post_journal_entry(JE-id)
   → Validates: 2 lines ✓, debits=5000, credits=5000, sums to zero ✓
   → Status: draft → posted
j. Link financial_transaction.journal_entry_id = JE-id
   → Status: posting → posted
k. Create wallet_transactions row (read model)
   → source=orchestrator, status=confirmed, source_event_id=event.id
l. Refresh wallet balance cache: refresh_wallet_balance_cache(wallet.id)
   → Calls get_account_balance(wallet_account_id) → ₦5,000
   → Updates wallets.cached_balance = 5000
m. Mark inbound_event as processed
   → Status: posted → completed
n. Return result: { id, transaction_reference, status: 'completed', journal_entry_id }
```

### 5. Customer checks balance
```
GET /api/wallets/{walletId}/balance
→ Returns cached_balance: ₦5,000
→ This was refreshed from the Ledger (not from wallet_transactions directly)
→ The Ledger is the source of truth
```

### Traceability
```
inbound_event (id=event-uuid)
  ↓ source_reference
financial_transaction (id=FT-2026-00000001)
  ↓ journal_entry_id
journal_entry (id=JE-2026-00000001, status=posted)
  ↓ journal_lines
  Line 1: Debit 1000 (Safe Haven Settlement) ₦5,000
  Line 2: Credit 2000.WAL-... (Customer Wallet) ₦5,000
  ↓
wallet_transactions (read model, status=confirmed)
  ↓
wallets.cached_balance = ₦5,000 (refreshed from ledger)
```

Every step is traceable via `correlation_id` and the `source_reference` chain.

---

## Wallet Balance: Cache vs. Source of Truth

**Phase 3 (before):** Balance = sum of `wallet_transactions` (confirmed credits - debits)
**Phase 4 (now):** Balance = `get_account_balance(wallet_account_id)` from journal lines

The `refresh_wallet_balance_cache()` function was updated to read from the Ledger. The `wallet_transactions` table remains as a read model (for UI display) but is no longer the source of truth for balance computation.

### Migration Path for Phase 3 Data
1. When wallets are activated, the trigger creates ledger accounts for them automatically
2. For existing wallets with `wallet_transactions` data: the event processor now calls the Orchestrator, which posts to the Ledger AND creates `wallet_transactions` rows
3. If there's a discrepancy between Phase 3's `wallet_transactions` sum and the Ledger, the reconciliation job (Phase 3) will flag it
4. **No backfill migration is needed yet** — no wallets have been activated in production, so there's no existing data to migrate

---

## What Phase 4 Is NOT

- ❌ Savings product logic (Phase 5)
- ❌ Loan product logic (Phase 6)
- ❌ Investment product logic (Phase 7)
- ❌ Interest calculations
- ❌ Fee charges
- ❌ Group savings logic

The Orchestrator is **product-agnostic**. It accepts semantic transaction requests and maps them to journal entries via configurable posting templates. Product modules will call the Orchestrator — they don't need to understand the chart of accounts.

---

## What Changes in Future Phases

| Phase | What Changes | Impact on Orchestrator |
|---|---|---|
| Phase 5 (Savings) | Add `savings_contribution`, `savings_withdrawal`, `savings_interest` templates | New posting template entries only — no code changes to Orchestrator core |
| Phase 6 (Loans) | Add `loan_disbursement`, `loan_repayment`, `loan_interest`, `loan_penalty` templates | Same — new templates, same calling contract |
| Phase 7 (Investments) | Add `investment_subscription`, `investment_redemption`, `investment_returns` templates | Same pattern |
| Future (Fees) | Add `fee_charge` template | Same pattern — fees debit wallet, credit fee revenue |

The Orchestrator's `initiate()` function doesn't need to know what a "savings contribution" is — it just needs a posting template that maps it to the right accounts. This is the key design decision that makes the platform extensible without code changes to the financial core.
