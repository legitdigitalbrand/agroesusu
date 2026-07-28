# Savings Engine

## Overview

The Savings Engine is the first real consumer of the Orchestrator/Ledger. It manages:
- **Product configuration** — admin-configurable savings products (no code deploy needed)
- **Account lifecycle** — open, activate, mature, withdraw, close
- **Deposit/withdrawal flows** — all financial movements go through the Orchestrator
- **Interest accrual** — scheduled job posts interest through the Orchestrator
- **Savings history signals** — pre-computed metrics for Phase 6 (Loan Engine) credit scoring

**Key principle:** No savings balance is ever written directly. All balances are derived from the Ledger. All financial movements (deposits, withdrawals, interest) go through the Orchestrator.

---

## Product Configuration

All product parameters live in the `savings_products` table. Admins can create/edit products without a code deploy.

### Seeded Products (Phase 5)

| Code | Name | Type | Interest | Min Deposit | Lock Period | Withdrawal |
|---|---|---|---|---|---|---|
| FLEX | Flexible Savings | flexible | 4% compound, daily | ₦100 | None | Anytime, no penalty |
| FD-90 | Fixed Deposit (90 Days) | fixed_deposit | 12% flat, at maturity | ₦5,000 | 90 days | Early withdrawal with 2% penalty |
| ESUSU-BASIC | Esusu Savings (Basic) | esusu | 0% | ₦100 | 30 days | No withdrawals during cycle |

### Config Fields

Each product defines:
- **Interest**: method (flat/compound/tiered), rate, cadence (daily/monthly/maturity)
- **Balance rules**: minimum balance, minimum deposit, maximum deposit
- **Withdrawal rules**: allowed?, lock period (days), early withdrawal penalty rate, max withdrawals/month
- **Term**: fixed term in days (for fixed deposits)
- **Eligibility**: minimum KYC level, minimum membership tenure
- **Group/Esusu**: min/max group size, contribution frequency

### Config Change Safety

When a product config changes, **existing accounts are not affected**. Each savings account captures a snapshot of the product terms at opening (`product_terms_snapshot` in `savings_accounts`). Config changes only apply to new accounts opened after the change.

---

## Account Lifecycle

```
pending → active → matured → withdrawn
                   ↘ closed
         ↘ closed
```

| State | Meaning | Entry Condition |
|---|---|---|
| `pending` | Account created, not yet funded | Customer opens a savings account |
| `active` | Account is active, receiving deposits | First deposit received |
| `matured` | Fixed deposit term has ended | Maturity date reached (for FD products) |
| `withdrawn` | Full balance withdrawn | Customer withdraws all funds |
| `closed` | Account closed by customer or admin | Explicit close action |

### Ledger Account Auto-Creation

When a savings account transitions to `active`, a trigger creates a child liability account under parent 2001 (Savings Holding Accounts) in the chart of accounts. Account code: `2001.{SAV-account-number}`.

---

## Deposit Flow

```
Customer initiates deposit
  ↓
Savings module validates (amount, product min deposit)
  ↓
Savings module looks up savings ledger account ID
  ↓
Savings module calls Orchestrator.initiate({
  transaction_type: 'savings_contribution',
  wallet_id: customer's wallet,
  product_account_id: savings ledger account,
  amount: deposit amount
})
  ↓
Orchestrator posts journal entry:
  Debit  Wallet (2000.{wallet})     — money leaves wallet
  Credit Savings (2001.{savings})    — money enters savings
  ↓
Orchestrator refreshes wallet balance cache
  ↓
Savings balance increases (computed from Ledger)
```

### Worked Example: Successful Deposit

Customer deposits ₦10,000 into their Flexible Savings account.

1. Customer calls `POST /api/savings/accounts/{id}/deposit` with `amount: 10000`
2. Savings module validates: account is active, ₦10,000 ≥ ₦100 minimum deposit ✓
3. Looks up savings ledger account: `2001.SAV-2026-00000001`
4. Calls `Orchestrator.initiate({ transaction_type: 'savings_contribution', amount: 10000, wallet_id: '...', product_account_id: '...' })`
5. Orchestrator posts:
   - Debit Wallet `2000.WAL-2026-00000001` ₦10,000
   - Credit Savings `2001.SAV-2026-00000001` ₦10,000
   - Zero-sum validated ✓
6. Wallet balance decreases by ₦10,000
7. Savings balance increases by ₦10,000 (computed from Ledger)

---

## Withdrawal Flow

```
Customer initiates withdrawal
  ↓
Savings module validates:
  - Account is active or matured
  - Withdrawals allowed for this product?
  - Lock period passed? (if active, not matured)
  - Early withdrawal penalty applies?
  - Sufficient balance?
  - Minimum balance maintained after withdrawal?
  ↓
If validation FAILS → return error (never reaches Orchestrator)
  ↓
If validation PASSES → call Orchestrator.initiate({
  transaction_type: 'savings_withdrawal',
  wallet_id: customer's wallet,
  product_account_id: savings ledger account,
  amount: withdrawal amount
})
  ↓
Orchestrator posts journal entry:
  Debit  Savings (2001.{savings})    — money leaves savings
  Credit Wallet (2000.{wallet})       — money enters wallet
  ↓
If full balance withdrawn → mark account as 'withdrawn'
```

### Worked Example: Successful Withdrawal (Matured Fixed Deposit)

Customer withdraws ₦50,000 from a matured 90-day Fixed Deposit.

1. Customer calls `POST /api/savings/accounts/{id}/withdraw` with `amount: 50000`
2. Savings module validates:
   - Account status: `matured` ✓
   - Withdrawals allowed ✓
   - Lock period: N/A (already matured) ✓
   - Balance: ₦52,500 (₦50,000 principal + ₦2,500 interest) ≥ ₦50,000 ✓
   - Minimum balance: ₦5,000, remaining ₦2,500 < ₦5,000 — but full withdrawal, so OK ✓
3. Calls Orchestrator → posts: Debit Savings ₦50,000, Credit Wallet ₦50,000
4. Remaining savings balance: ₦2,500 (₦52,500 - ₦50,000)

### Worked Example: REJECTED Early Withdrawal (Locked Fixed Deposit)

Customer tries to withdraw ₦10,000 from a 90-day Fixed Deposit that's been active for 30 days.

1. Customer calls `POST /api/savings/accounts/{id}/withdraw` with `amount: 10000`
2. Savings module validates:
   - Account status: `active` ✓
   - Withdrawals allowed: yes (with conditions) ✓
   - Lock period: 90 days, only 30 days elapsed → **LOCKED**
   - Early withdrawal allowed: yes (but with 2% penalty)
   - Penalty: ₦10,000 × 2% = ₦200
   - Net amount: ₦9,800
3. Validation passes with penalty → calls Orchestrator with ₦10,000
4. Posts: Debit Savings ₦10,000, Credit Wallet ₦10,000
5. Penalty (₦200) tracked in metadata — separate fee transaction (future enhancement)

### Worked Example: REJECTED Withdrawal (Esusu During Cycle)

Customer tries to withdraw from an Esusu account mid-cycle.

1. Customer calls `POST /api/savings/accounts/{id}/withdraw` with `amount: 5000`
2. Savings module validates:
   - Account status: `active` ✓
   - Withdrawals allowed: **NO** (`withdrawal_allowed = false` for ESUSU-BASIC)
3. **Returns error: "Withdrawals are not allowed for this savings product"**
4. **Never reaches the Orchestrator. No ledger impact.**

---

## Interest Accrual

Interest is a financial transaction — it posts through the Orchestrator like any other movement. No direct ledger writes.

### Calculation Methods

| Method | Formula | Use Case |
|---|---|---|
| Flat | `P × (R/100) × (days/365)` | Fixed deposits |
| Compound | `P × ((1 + R/100/365)^days - 1)` | Flexible savings |
| Tiered | Rate varies by balance tier | Future |

### Accrual Cadence (per product config)

| Cadence | When | Example |
|---|---|---|
| Daily | Every day at 1 AM (Vercel cron) | Flexible Savings (4% compound) |
| Monthly | Every 30 days | Future products |
| Maturity | Only when term ends | Fixed Deposit (12% at 90 days) |

### Worked Example: Daily Interest Accrual

Flexible Savings account with ₦100,000 balance, 4% annual compound interest.

1. Cron job triggers at 1 AM: `POST /api/cron/accrue-interest`
2. For each active account due for accrual:
   - Account: SAV-2026-00000001, balance ₦100,000, rate 4%, compound, daily
   - Days elapsed: 1 (daily cadence)
   - Interest = ₦100,000 × ((1 + 0.04/365)^1 - 1) = ₦10.96
3. Calls Orchestrator with `savings_interest` type:
   - Debit Interest Expense (5000) ₦10.96
   - Credit Savings Account (2001.SAV-...) ₦10.96
4. Updates account: `total_interest_earned += ₦10.96`, `last_interest_accrued_at = now`, `next_accrual_at = tomorrow`

### Interest Expense Account

Interest posts as: Debit Interest Expense (5000), Credit Savings Account (2001.{savings}).

The Interest Expense account (5000) is a system account in the chart of accounts, seeded in Phase 4's migration 00012. It's an expense account — debits increase it (platform's cost of using customer money).

---

## Savings History Signal (for Phase 6)

The `savings_history_signals` table captures pre-computed savings behavior metrics. Phase 6 (Loan Engine) will consume this for credit scoring and "up to 3× savings balance" eligibility.

### Signal Shape

| Field | Type | Description |
|---|---|---|
| `total_savings_balance` | decimal | Sum across all active savings accounts (from Ledger) |
| `active_account_count` | int | Number of active savings accounts |
| `product_diversity` | int | Count of distinct product types |
| `savings_tenure_days` | int | Days since earliest savings account opened |
| `contribution_count_30d` | int | Deposits in last 30 days |
| `contribution_count_90d` | int | Deposits in last 90 days |
| `withdrawal_count_90d` | int | Withdrawals in last 90 days |
| `total_interest_earned` | decimal | Cumulative interest across all accounts |
| `consistency_score` | int (0-100) | Regularity of contributions |
| `stability_score` | int (0-100) | Balance stability (low withdrawal rate) |
| `tenure_score` | int (0-100) | Length of savings history |

### Why This Shape

1. **Pre-computed, not on-the-fly**: Credit scoring needs fast access. Aggregating from the Ledger for every loan application would be slow.

2. **Daily snapshots**: Time-series behavior matters. "Has the customer been saving consistently for 6 months?" needs historical data, not just current balance.

3. **Three scores, not one**: Phase 6 will compute the final credit score by weighting consistency, stability, and tenure according to its own rules. We provide the raw signals, not the final score.

4. **Phase 6 can query**: `SELECT * FROM savings_history_signals WHERE customer_id = ? ORDER BY snapshot_date DESC LIMIT 1` — simple, stable interface.

### How Phase 6 Will Use This

The "up to 3× savings balance" rule (per Volume 02 Part 2.6) will read:
- `total_savings_balance` → the eligible savings balance for the multiplier
- `consistency_score` → factor in loan eligibility (e.g., require minimum 50)
- `tenure_score` → minimum tenure requirement (e.g., must have 90+ days of savings)
- `stability_score` → lower score = higher risk = lower loan-to-savings ratio

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/savings/products` | GET | Authenticated | List active savings products |
| `/api/savings/accounts` | POST | Customer (own) or staff | Open a savings account |
| `/api/savings/accounts` | GET | Customer (own) or staff | List savings accounts |
| `/api/savings/accounts/[accountId]` | GET | Owner or staff | Get account details + balance |
| `/api/savings/accounts/[accountId]/deposit` | POST | Owner or staff | Deposit into savings |
| `/api/savings/accounts/[accountId]/withdraw` | POST | Owner or staff | Withdraw from savings |
| `/api/cron/accrue-interest` | POST | CRON_SECRET | Daily interest accrual |

---

## Orchestrator Contract Extension

Phase 5 extended the `FinancialTransactionRequest` with:

```typescript
product_account_id?: string;  // The savings/loan/investment ledger account ID
```

The Savings module looks up the savings account's ledger account ID (via `get_savings_account_id` RPC) before calling `initiate()`. The Orchestrator passes this to the posting template, which uses it to build the correct journal lines.

New posting templates added:
- `savings_contribution`: Debit Wallet, Credit Savings Account
- `savings_withdrawal`: Debit Savings Account, Credit Wallet
- `savings_interest`: Debit Interest Expense, Credit Savings Account

---

## What Phase 5 Is NOT

- ❌ Loan eligibility scoring (Phase 6)
- ❌ Group savings governance — elections, committees, voting (Phase 7)
- ❌ Investment products (later phase)
- ❌ Tiered interest rates (future enhancement)
- ❌ Fee charges for early withdrawal penalties (penalty tracked but not yet charged as a separate transaction)
