# Investment & Wealth Management Module

## Overview

Phase 8 builds the Investment & Wealth Management Module — the platform's investment product engine. Investments are DISTINCT from Savings (separate module, shared infrastructure). All subscriptions, redemptions, and returns go through the Orchestrator. Mandatory risk disclosure is permanently stored before any subscription.

**Key principle:** The Orchestrator contract is unchanged — the Investment Module calls the same `initiate()` function that Savings, Loans, and Group Savings use.

---

## Return Guarantee Distinction (HONEST by design)

Every investment product has a `return_guarantee` field that honestly tells the customer (and the system) whether returns are contractual or not:

| Return Guarantee | Meaning | Products | Returns Source |
|---|---|---|---|
| `guaranteed` | Rate is contractually guaranteed | Fixed Income Fund (INV-0001) | Formula: rate × principal × time |
| `expected` | Target rate, highly likely but not contractual | Money Market Fund (INV-0004) | Formula (same as guaranteed, but disclosed as "expected") |
| `variable_pool` | Returns depend on actual pool performance | Agricultural Pool (INV-0002), Cooperative Growth Fund (INV-0003) | Admin-entered pool performance records |

**Critical rule:** Products with `variable_pool` return_guarantee must NEVER have their `expected_return_rate` displayed as guaranteed. The `expected_return_rate` on these products is a TARGET/PROJECTION only — actual returns come from pool performance.

The daily returns cron (`batchProcessReturns`) **skips** `variable_pool` products. Their returns are distributed manually by admin after entering pool performance data.

---

## Seeded Products

| Code | Name | Type | Rate | Guarantee | Risk | Min | Tenure | Coop? |
|---|---|---|---|---|---|---|---|---|
| INV-0001 | Fixed Income Fund — 90 Day | fixed_income | 12% flat | **guaranteed** | low | ₦5,000 | 90 days | No |
| INV-0002 | Agricultural Pool — Maize Cycle | agricultural_pool | 18% compound | **variable_pool** | high | ₦10,000 | 180 days | Yes |
| INV-0003 | Cooperative Growth Fund — AgroEsusu | cooperative_fund | 15% compound | **variable_pool** | moderate | ₦5,000 | open-ended | Yes |
| INV-0004 | Money Market Fund — AgroLiquid | money_market | 8% compound | **expected** | low | ₦1,000 | open-ended | No |

---

## Accounting Model

All investment operations go through the Orchestrator with these posting templates:

| Transaction | Debit | Credit | Description |
|---|---|---|---|
| Subscription | Wallet (2000.{wallet}) | Investment Settlement (2003.{investment}) | Customer invests money |
| Redemption | Investment Settlement (2003.{investment}) | Wallet (2000.{wallet}) | Customer withdraws (net of fees) |
| Returns (payout) | Interest Expense (5000) | Wallet (2000.{wallet}) | Returns paid to wallet |
| Returns (reinvest) | Interest Expense (5000) | Investment Settlement (2003.{investment}) | Returns added to investment |
| Pool distribution (payout) | Interest Expense (5000) | Wallet (2000.{wallet}) | Pool returns paid to contributor |
| Pool distribution (reinvest) | Interest Expense (5000) | Investment Settlement (2003.{investment}) | Pool returns reinvested |

Investment settlement accounts are liabilities (2003 parent) — the platform owes the customer their investment back.

---

## Risk Disclosure (Mandatory Per Standing Instructions)

Every investment subscription requires:
1. **Full disclosure text** displayed to the customer before subscription
2. **Explicit acceptance** — `accept_risk_disclosure: true` in the request
3. **Permanent storage** — the full text, version, product name, risk level, IP address, and user agent are stored in `risk_disclosure_acceptances` table (append-only, never deleted)
4. **Version tracking** — if the product's disclosure text changes, the version increments; existing acceptances preserve the original version's text

The `investment_accounts` table has a CHECK constraint: `status = 'pending' OR risk_disclosure_accepted = true` — an account cannot be activated without disclosure acceptance.

---

## Worked Example 1 — Fixed Investment: Contribution → Return Accrual → Maturity Payout

**Product:** Fixed Income Fund — 90 Day (INV-0001, 12% flat, guaranteed)
**Customer:** Subscribes ₦100,000

### Step 1: Subscription
1. Customer browses products → sees INV-0001 with `return_guarantee = 'guaranteed'`, 12% rate, 90-day tenure
2. Customer subscribes: `POST /api/investments/accounts` with `product_id, wallet_id, amount: 100000, accept_risk_disclosure: true`
3. Module validates: min investment (₦5,000 ✓), no cooperative requirement
4. Creates investment account (pending) with terms snapshot capturing: rate=12%, return_type=flat, tenure=90 days
5. Permanently stores risk disclosure acceptance (full text + version + IP + user agent)
6. Activates account → trigger creates ledger account `2003.INV-ACC-000001`
7. Calls Orchestrator: `investment_subscription` → D Wallet ₦100,000, C Investment Settlement ₦100,000
8. Records investment transaction (subscription, ₦100,000)

**Accounting state after subscription:**
- Wallet: ₦100,000 debited (decreased)
- Investment Settlement (2003.INV-ACC-000001): ₦100,000 credited (increased)
- Investment value: ₦100,000

### Step 2: Daily Return Accrual (Days 1-90)
Daily cron at 9 AM processes returns. For `guaranteed` products:
- Days elapsed: 1 (first day)
- Gross returns: ₦100,000 × 12% × (1/365) = ₦32.88
- Management fee: ₦100,000 × 0.5% × (1/365) = ₦1.37
- Net returns: ₦31.51
- `auto_reinvest = false` → payout: `investment_returns` → D Interest Expense ₦31.51, C Wallet ₦31.51

After 90 days:
- Total returns paid: ₦100,000 × 12% × (90/365) = ₦2,958.90 (minus ~₦123.29 management fee) = ₦2,835.61
- Investment value remains ₦100,000 (returns were paid out, not reinvested)
- Wallet received ₦2,835.61 in returns over 90 days

### Step 3: Maturity
1. Daily cron marks the account as `matured` (maturity_date reached)
2. Customer sees maturity status with options: redeem or rollover

### Step 4: Maturity Payout (Redemption)
1. Customer redeems: `POST /api/investments/accounts/{id}/redeem` with `wallet_id`
2. No early exit fee (at maturity, no penalty)
3. Calls Orchestrator: `investment_redemption` → D Investment Settlement ₦100,000, C Wallet ₦100,000
4. Account status → `redeemed`

**Final accounting state:**
- Wallet: ₦100,000 (principal returned) + ₦2,835.61 (returns paid over 90 days) = ₦102,835.61 total received
- Interest Expense (5000): ₦2,835.61 (total cost to platform)
- Investment Settlement: ₦0 (fully redeemed)

### Alternative: Rollover
Instead of redemption, customer can rollover:
1. `POST /api/investments/accounts/{id}/rollover` with `wallet_id`
2. Module redeems matured investment → ₦100,000 to wallet
3. Creates new investment account with SAME product (gets current product config — new terms if changed)
4. Subscribes ₦100,000 from wallet → new investment account
5. Links: new account.rolled_over_from = old account ID

---

## Worked Example 2 — Agricultural Investment Pool: Contribution → Performance Entry → Proportional Distribution

**Product:** Agricultural Investment Pool — Maize Cycle (INV-0002, 18% expected, `variable_pool`)
**Three customers:** Alice (₦50,000), Bob (₦30,000), Carol (₦20,000)

### Step 1: Contributions
Each customer subscribes (requires cooperative membership):
1. Alice: `POST /api/investments/accounts` → Orchestrator: D Wallet ₦50,000, C Investment Settlement ₦50,000
2. Bob: same → ₦30,000
3. Carol: same → ₦20,000

**Total pool value: ₦100,000**
**Pool shares:**
- Alice: 50% (₦50,000 / ₦100,000)
- Bob: 30% (₦30,000 / ₦100,000)
- Carol: 20% (₦20,000 / ₦100,000)

### Step 2: Pool Performance Entry (ADMIN — manually entered)
After the maize harvest, admin enters the actual pool performance:

```
POST /api/investments/products/INV-0002/performance
{
  "performance_date": "2026-12-15",
  "period_start": "2026-07-01",
  "period_end": "2026-12-15",
  "total_pool_value": 100000,
  "total_returns": 20000,       // ₦20,000 actual returns from crop sales
  "return_rate": 20.0,          // 20% actual return (vs 18% expected)
  "expense_ratio": 1.5,         // 1.5% expenses
  "source_description": "Maize harvest sales completed — 2026 wet season",
  "supporting_notes": "Total crop sales: ₦120,000 from 5 cooperative farms. Verified by cooperative treasurer.",
  "source_reference": "COOP-0001-RES-2026-003"
}
```

**Audit trail captured:**
- WHO: admin staff user ID (entered_by)
- WHEN: timestamp (entered_at)
- WHAT: ₦20,000 returns, 20% rate, ₦300 expenses
- WHY: "Maize harvest sales completed"
- SOURCE REFERENCE: COOP-0001-RES-2026-003 (board resolution)

**Net distributable:** ₦20,000 - ₦300 = ₦19,700

### Step 3: Proportional Distribution (ADMIN triggers)
Admin triggers distribution:

```
POST /api/investments/products/INV-0002/distribute
{
  "performance_record_id": "uuid-of-performance-record"
}
```

**Distribution calculation:**
- Alice: 50% × ₦19,700 = ₦9,850
- Bob: 30% × ₦19,700 = ₦5,910
- Carol: 20% × ₦19,700 = ₦3,940

**Each distribution goes through the Orchestrator:**

Alice (auto_revest = false → payout):
- Orchestrator: `investment_returns` → D Interest Expense ₦9,850, C Alice's Wallet ₦9,850
- Pool distribution record: { pool_share: 0.50, distributed_amount: 9850, type: 'payout' }

Bob (auto_revest = true → reinvest):
- Orchestrator: `investment_reinvest` → D Interest Expense ₦5,910, C Bob's Investment Settlement ₦5,910
- Bob's investment value: ₦30,000 + ₦5,910 = ₦35,910
- Pool distribution record: { pool_share: 0.30, distributed_amount: 5910, type: 'reinvest' }

Carol (auto_revest = false → payout):
- Orchestrator: `investment_returns` → D Interest Expense ₦3,940, C Carol's Wallet ₦3,940
- Pool distribution record: { pool_share: 0.20, distributed_amount: 3940, type: 'payout' }

**Performance record marked as distributed:** `is_distributed = true`, `distributed_amount = 19,700`

### Audit Trail
Every step is traceable:
- `pool_performance_records`: who entered performance, when, based on what source
- `pool_distributions`: each contributor's share, amount, distribution type, FT reference
- `investment_transactions`: individual transaction records
- `financial_transactions` (Orchestrator): state machine for each posting
- `journal_entries` + `journal_lines` (Ledger): immutable double-entry records

---

## Pool Performance Data Source — HONEST Documentation

### What's Production-Ready
- **Pool performance recording:** Admin can enter pool performance with full audit trail (who, when, what, why, source reference)
- **Proportional distribution:** System calculates each contributor's share and distributes through the Orchestrator
- **Distribution records:** Each distribution is individually recorded with FT reference

### What's a Placeholder
- **Performance data itself:** Manually entered by admin staff based on real-world outcomes. There is NO automated data feed.
- **Expense ratio:** Currently a simple percentage. A more sophisticated expense model (itemized costs) would be a future enhancement.

### Future Integration Points (NOT built)
- **Crop yield APIs:** Would feed directly into the admin entry interface (same `recordPoolPerformance` function)
- **Market price feeds:** Would provide market prices for crop valuation
- **Cooperative profit reports:** Would feed into the Cooperative Growth Fund performance entry
- **External audit verification:** Would add a verification step before distribution

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/investments/products` | GET | Authenticated | List active investment products |
| `/api/investments/accounts` | POST | Customer | Subscribe to investment |
| `/api/investments/accounts` | GET | Customer | List own investment accounts |
| `/api/investments/accounts/[accountId]` | GET | Customer/Staff | Account details + transactions |
| `/api/investments/accounts/[accountId]/redeem` | POST | Customer | Redeem investment |
| `/api/investments/accounts/[accountId]/rollover` | POST | Customer | Rollover matured investment |
| `/api/investments/products/[productId]/performance` | GET | Staff | List pool performance records |
| `/api/investments/products/[productId]/performance` | POST | Admin | Enter pool performance data |
| `/api/investments/products/[productId]/distribute` | POST | Admin | Trigger proportional distribution |
| `/api/cron/process-returns` | POST | CRON_SECRET | Daily returns + maturities (9 AM) |

---

## What Phase 8 Is NOT

- ❌ Advanced portfolio management (rebalancing, diversification rules)
- ❌ Secondary market trading between investors
- ❌ Real-time NAV calculation from market data feeds
- ❌ Tax reporting (withholding tax on investment returns)
- ❌ Investment insurance or capital guarantees
- ❌ Fractional unit trading on external exchanges
- ❌ Palm Estate Investments, Government Programs, Climate Finance, Carbon Credits (future products — documented only, not built)
- ❌ Cross-module reporting/analytics dashboards (Phase 9 owns this)
