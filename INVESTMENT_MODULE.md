# Investment & Wealth Management Module

## Overview

Phase 8 builds the Investment & Wealth Management Module — the platform's investment product engine. Investments are DISTINCT from Savings (separate module, shared infrastructure). All subscriptions, redemptions, and returns go through the Orchestrator. Mandatory risk disclosure is permanently stored before any subscription.

**Key principle:** The Orchestrator contract is unchanged — the Investment Module calls the same `initiate()` function that Savings, Loans, and Group Savings use. No new Orchestrator changes were needed (only new posting templates).

---

## Seeded Products

| Code | Name | Type | Rate | Risk | Min | Tenure | Coop? |
|---|---|---|---|---|---|---|---|
| INV-0001 | Fixed Income Fund — 90 Day | fixed_income | 12% flat | low | ₦5,000 | 90 days | No |
| INV-0002 | Agricultural Investment Pool — Maize Cycle | agricultural_pool | 18% compound | high | ₦10,000 | 180 days | Yes |
| INV-0003 | Cooperative Growth Fund — AgroEsusu | cooperative_fund | 15% compound | moderate | ₦5,000 | 365+ days (open) | Yes |
| INV-0004 | Money Market Fund — AgroLiquid | money_market | 8% compound | low | ₦1,000 | 1+ days (open) | No |

---

## Accounting Model

All investment operations go through the Orchestrator with these posting templates:

| Transaction | Debit | Credit | Description |
|---|---|---|---|
| Subscription | Wallet (2000.{wallet}) | Investment Settlement (2003.{investment}) | Customer invests money |
| Redemption | Investment Settlement (2003.{investment}) | Wallet (2000.{wallet}) | Customer withdraws (net of fees) |
| Returns (payout) | Interest Expense (5000) | Wallet (2000.{wallet}) | Returns paid to wallet |
| Returns (reinvest) | Interest Expense (5000) | Investment Settlement (2003.{investment}) | Returns added to investment |

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

## Worked Example — End-to-End Subscription

**Scenario:** Customer subscribes ₦50,000 to Agricultural Investment Pool — Maize Cycle (INV-0002).

1. **Customer browses products** → `GET /api/investments/products`
   - Returns 4 products with full risk disclosure text

2. **Customer subscribes** → `POST /api/investments/accounts`
   - Body: `{ product_id, wallet_id, amount: 50000, accept_risk_disclosure: true }`
   - Validates: cooperative membership (required for INV-0002), min investment (₦10,000 ✓)

3. **Investment module:**
   - Creates investment account (pending) with terms snapshot
   - Permanently stores risk disclosure acceptance (full text + version + IP + user agent)
   - Activates account → trigger creates ledger account 2003.INV-ACC-XXXXXX
   - Calls Orchestrator: `investment_subscription` D Wallet ₦50,000, C Investment Settlement ₦50,000
   - Records investment transaction (subscription)
   - Returns: `{ account, transaction_reference }`

4. **Accounting impact:**
   - Wallet account (2000.{wallet}): decreased by ₦50,000 (debit)
   - Investment Settlement (2003.{investment}): increased by ₦50,000 (credit)
   - Customer's wallet balance = ₦50,000 less
   - Investment value = ₦50,000

5. **Daily returns processing** (cron at 9 AM):
   - Days elapsed since last valuation: 1
   - Gross returns: ₦50,000 × 18% × (1/365) = ₦24.66
   - Management fee: ₦50,000 × 1.5% × (1/365) = ₦2.05
   - Net returns: ₦22.61
   - Auto-reinvest enabled → `investment_reinvest` D Interest Expense ₦22.61, C Investment Settlement ₦22.61
   - Investment value = ₦50,022.61

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/investments/products` | GET | Authenticated | List active investment products |
| `/api/investments/accounts` | POST | Customer | Subscribe to investment |
| `/api/investments/accounts` | GET | Customer | List own investment accounts |
| `/api/investments/accounts/[accountId]` | GET | Customer/Staff | Account details + transactions |
| `/api/investments/accounts/[accountId]/redeem` | POST | Customer | Redeem investment |
| `/api/cron/process-returns` | POST | CRON_SECRET | Daily returns + maturities (9 AM) |

---

## What Phase 8 Is NOT

- ❌ Advanced portfolio management (rebalancing, diversification rules)
- ❌ Secondary market trading between investors
- ❌ Real-time NAV calculation from market data feeds
- ❌ Tax reporting (withholding tax on investment returns)
- ❌ Investment insurance or capital guarantees
- ❌ Fractional unit trading on external exchanges
