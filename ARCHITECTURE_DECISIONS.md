# Architecture Decision Records (ADR)

> Per Volume 04 Part 4.23 — every significant architectural decision must be captured in an ADR.
> Format: ADR-NNN | Title | Date | Status | Context | Decision | Consequences

---

## ADR-001: Schema Convention — Public Schema with Table Prefixing

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Use the `public` schema with clear table naming conventions instead of schema-per-domain. Domain isolation is enforced at the code layer via DDD module structure.

### Consequences
- All tables live in `public` schema. RLS policies apply per-table.
- Domain boundaries are enforced in code, not in database schema.

---

## ADR-002: RBAC Enforcement — Defense in Depth (BFF + Database RLS)

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Enforce RBAC at both the BFF layer and the database (RLS) layer. BFF provides fast 403s; RLS is the security backstop.

---

## ADR-003: Dual Identity Model — Customer Auth vs. Staff Auth

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Both customers and staff authenticate via Supabase Auth (`auth.users`). Separate identity tables (`customers` vs `staff_users`) keep authorization models cleanly separated.

---

## ADR-004: Audit Log Immutability — Dual Enforcement

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
RLS (no UPDATE/DELETE policies) + trigger backstop (raises exception even for service_role).

---

## ADR-005: Safe Haven Anti-Corruption Layer — Domain DTOs Only

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
The `integrations` module exposes an `IBankingProvider` interface with domain-facing DTOs. Safe Haven adapter translates internally. Domain modules import from `/src/modules/integrations/index.ts` only.

### Consequences
- Adding a second banking provider means implementing a new `IBankingProvider` — domain modules don't change.
- Mock provider enables development without credentials.

---

## ADR-006: Wallet Balance as Cache — Not Source of Truth

**Date:** 2026-07-28  
**Status:** Updated (Phase 3)  

### Context
Phase 2 created the wallets table with a `cached_balance` field. Phase 3 introduces the mechanism for updating it.

### Decision
**Updated in Phase 3:** The balance cache is now computed as the **sum of confirmed `wallet_transactions`** (credits - debits), NOT from Safe Haven's API directly. This is a shift from the Phase 2 design (which read from Safe Haven's `GET /accounts/{id}`).

**Why the change:** Reading from Safe Haven on every balance request is slow and unreliable. Computing from our own confirmed transactions is:
1. Internally consistent — we can explain why the balance is what it is
2. Fast — no external API call needed
3. Auditable — every balance change is traceable to a specific transaction
4. Prepares for Phase 5 — the Ledger will also be sum-based

Safe Haven's reported balance is now used ONLY for reconciliation (external consistency check), not for display.

The `refresh_wallet_balance_cache()` SQL function is the ONLY sanctioned way to update the balance. It is called only from the event processor and the reconciliation process (after manual flag resolution — never auto-correct).

### Consequences
- Balance is eventually consistent with Safe Haven — there may be a lag between a webhook arriving and the balance updating.
- Reconciliation catches discrepancies between our computed balance and Safe Haven's actual balance.
- When Phase 5 arrives, `refresh_wallet_balance_cache()` will be updated to read from the Ledger instead of `wallet_transactions`.
- The ACL boundary holds: no customer/staff endpoint reads Safe Haven directly for balance.

---

## ADR-007: Idempotency Strategy — Deterministic Keys with 24h TTL

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Every outbound Safe Haven call generates a deterministic idempotency key. Keys stored in `idempotency_keys` table with 24h TTL. Retries return stored results — no duplicate execution.

---

## ADR-008: Webhook Security — Signature Verification + Landing Zone

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
HMAC-SHA256 signature verification + append-only landing zone in `inbound_events`. Webhook handler stores event and returns 200 immediately. Processing is async.

---

## ADR-009: Transaction Read Model — wallet_transactions as Append-Only History

**Date:** 2026-07-28  
**Status:** Accepted  

### Context
Phase 3 introduces `wallet_transactions` as the read model for money movement. This is what customers and staff see when they view transaction history. It is NOT the Ledger (Phase 5).

### Decision
`wallet_transactions` is an append-only table populated from processed Phase 2 inbound events. Each row correlates to a `source_event_id` in the Phase 2 landing table (unique constraint prevents duplicate processing). Status lifecycle: `pending → confirmed / failed`. Reversals create new rows — originals are never modified.

### Consequences
- Transaction history is queryable, paginated, and filterable — the first real read endpoints for customer-facing UI.
- The read model is eventually consistent with Safe Haven (via webhook events), not with the Ledger yet.
- When Phase 5 arrives, the Orchestrator will create `wallet_transactions` rows as part of its lifecycle, not just the event processor.
- The unique index on `source_event_id` ensures one transaction per inbound event — duplicate webhook processing is safe.

---

## ADR-010: Reconciliation — Never Auto-Correct

**Date:** 2026-07-28  
**Status:** Accepted  

### Context
In a regulated-money system, silently auto-correcting balance discrepancies would destroy trust. If our balance and Safe Haven's balance disagree, a human must investigate before any adjustment is made.

### Decision
Reconciliation discrepancies are stored in `reconciliation_flags` with status `open`. They are NEVER auto-resolved by code. All flags require human investigation and manual resolution (with resolution type and notes). The reconciliation job runs daily at 2 AM and on-demand.

Two checks are performed:
1. **Internal consistency:** `cached_balance` == SUM(confirmed transactions) — catches cache refresh bugs
2. **External consistency:** our balance vs Safe Haven's reported balance — catches missing webhooks or SH-side adjustments

Tolerance: ₦1.00 (rounding). Anything beyond that creates a flag.

### Consequences
- Discrepancies are visible to compliance/finance staff via the `reconciliation_flags` table and API endpoint.
- Resolution requires `compliance.update` permission (compliance officers + super_admin).
- Every resolution is audited (resolution type, notes, resolver, timestamp).
- When Phase 5 arrives, reconciliation will also compare against the Ledger — Safe Haven becomes a secondary check.

---

## ADR-011: Event Processing — Sequential per Wallet, Async Overall

**Date:** 2026-07-28  
**Status:** Accepted  

### Context
The event processor picks up `received` events from `inbound_events` and creates `wallet_transactions` rows. If events for the same wallet are processed in parallel, balance calculations could race.

### Decision
Events are processed sequentially per wallet (not globally sequential — different wallets can process in parallel). The processor batches up to 50 events per run, processes them in order, and uses a database transaction per event (create transaction + refresh balance + mark event processed — all atomic).

### Consequences
- No balance race conditions within a single wallet.
- Processing is resilient — a single event failure doesn't block other events.
- Failed events stay in the landing table with `processing_status = failed` and are retriable.
- After 3 failed attempts, events should be escalated (alerting comes in Phase 4+).
- The processor is triggered every 5 minutes by Vercel Cron and can be manually triggered.

---

## ADR-012: Double-Entry Ledger — The System of Financial Record

**Date:** 2026-07-28  
**Status:** Accepted  

### Context
Phase 3 treated wallet balance as a cache derived from `wallet_transactions` — useful for display but not an accounting system. Phase 4 introduces the Ledger as the authoritative financial record. At any point, "why does this customer have this balance?" must be answerable by replaying immutable ledger entries.

### Decision
The Ledger (`journal_entries` + `journal_lines`) is the single source of truth for all balances. The chart of accounts defines 13 system accounts plus per-wallet liability accounts. Wallet balances are now computed from `get_account_balance()` which sums journal lines, replacing Phase 3's sum-of-wallet_transactions approach.

### Zero-Sum Enforcement (DB-level)
1. `post_journal_entry()` function validates SUM(debits) = SUM(credits) before posting
2. Immutability trigger: journal lines are INSERT-only (no UPDATE/DELETE ever)
3. Draft-only insertion: lines can only be added to draft entries
4. Status transition trigger: only draft→posted and posted→reversed allowed

### Consequences
- `refresh_wallet_balance_cache()` now reads from the Ledger, not from `wallet_transactions`
- `wallet_transactions` remains as a read model but is no longer the balance authority
- All financial movements must produce balanced double-entry journal rows
- Corrections are always new reversing entries — no edits to posted data
- The platform is now defensible to a regulator or auditor

---

## ADR-013: Orchestrator as the Sole Entry Point for Financial Movements

**Date:** 2026-07-28  
**Status:** Accepted  

### Context
Without a single entry point, different modules could post to the Ledger in inconsistent ways. The Orchestrator (FTO) ensures every financial movement is validated, sequenced, and properly journaled.

### Decision
The Orchestrator (`/src/modules/orchestrator/`) is the ONLY module that writes to `journal_entries` and `journal_lines`. All other modules (Wallet, Savings, Loans, Investments) call `Orchestrator.initiate()` with a semantic `FinancialTransactionRequest`. The Orchestrator maps the request to journal lines via configurable posting templates.

### Calling Contract
```
Module → initiate({ transaction_type, source_module, source_reference, amount, idempotency_key, wallet_id })
  → Orchestrator validates, creates journal entry, posts, refreshes balance cache
  → Returns FinancialTransactionResult { id, transaction_reference, status, journal_entry_id }
```

### Consequences
- New product types (Savings, Loans, Investments) only need new posting templates — no changes to the Orchestrator core
- The Orchestrator is product-agnostic — it doesn't know what a "savings contribution" is, just how to post it
- Idempotency at the Orchestrator level prevents duplicate domain-level transactions regardless of caller
- Every state transition is logged with timestamps in `financial_transactions`

---

## ADR-014: Reversal Pattern — New Entries, Never Edits

**Date:** 2026-07-28  
**Status:** Accepted  

### Context
In a double-entry system, correcting a posted entry by editing it would destroy the audit trail. Regulators require that corrections be traceable.

### Decision
Reversals always create a NEW journal entry with opposite debits/credits. The original entry is marked as `reversed` (status change only, lines unchanged). The reversal entry references the original via `reverses` / `reversed_by`. Net balance effect: zero.

### Worked Example
```
Original: Debit 5000 / Credit 5000 (posted → reversed)
Reversal: Credit 5000 / Debit 5000 (posted)
Net: 0
```

### Consequences
- The audit trail is complete — both the original and the reversal are visible
- No posted data is ever modified — full immutability
- Reversals can be reversed (if needed) by creating another reversing entry
- The `reverse_journal_entry()` SQL function handles the entire process atomically

---

## ADR-015: Wallet Balance — Ledger-Derived, Not Cached from Transactions

**Date:** 2026-07-28  
**Status:** Accepted (supersedes ADR-006 Phase 3 version)  

### Context
Phase 3 computed wallet balance from `wallet_transactions` (confirmed credits - debits). Phase 4 introduces the Ledger as the authoritative source. Having two sources of truth (wallet_transactions and journal_lines) would create reconciliation ambiguity.

### Decision
`refresh_wallet_balance_cache()` now calls `get_account_balance(wallet_account_id)` which sums journal lines from the Ledger. `wallet_transactions` remains as a read model for UI display but is no longer the balance authority.

### Migration Path
1. When wallets are activated, a trigger creates their ledger account automatically
2. The event processor now calls the Orchestrator, which posts to the Ledger AND creates `wallet_transactions` rows
3. No backfill needed yet — no wallets have been activated in production
4. If discrepancies arise between Phase 3 data and Ledger, the reconciliation job flags them

### Consequences
- There is ONE source of truth for balances: the Ledger
- `wallet_transactions` is a derived read model, not authoritative
- Reconciliation now compares: Ledger balance vs Safe Haven reported balance (Phase 3's reconciliation job updated in Phase 5)
- When Phase 5 (Savings) arrives, savings balances will also be Ledger-derived via the same mechanism

---

## ADR-016: Savings Product Configuration — Config Table with Terms Snapshot

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
All savings product parameters (interest rates, min balances, withdrawal rules, penalties) live in the `savings_products` table. Each savings account captures a `product_terms_snapshot` at opening — config changes only apply to new accounts, not existing ones.

### Consequences
- Admins can launch new products without a code deploy
- Existing account terms are frozen at opening — no retroactive changes
- If a rate change needs to apply to existing accounts, it requires an explicit migration decision (flagged to CTO)

---

## ADR-017: Withdrawal Validation Placement — Savings Module, Not Orchestrator

**Date:** 2026-07-28  
**Status:** Accepted  

### Context
The Orchestrator is product-agnostic — it doesn't know about lock periods or penalties. If withdrawal rules were enforced in the Orchestrator, it would need product-specific knowledge, violating the separation of concerns.

### Decision
All product rule validation (lock periods, penalties, minimum balances, withdrawal eligibility) happens in the Savings module BEFORE calling the Orchestrator. If validation fails, the request is rejected — it never reaches the Ledger. Reversal is for correcting mistakes, not for enforcing everyday business rules.

### Consequences
- The Orchestrator stays generic — it doesn't need to understand savings products
- Rule violations fail cleanly with descriptive errors (no post-then-reverse)
- Product rules can change without touching the Orchestrator
- The Savings module owns all product-specific business logic

---

## ADR-018: Interest as a Transaction — Through the Orchestrator

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Interest accrual posts through the Orchestrator like any other financial transaction. No direct ledger writes, no special-cased balance bumps. The Orchestrator posts: Debit Interest Expense (5000), Credit Savings Account (2001.{savings}).

### Consequences
- Interest is fully auditable — every accrual is a journal entry with a traceable transaction record
- Interest accrual is idempotent (keyed by account + date)
- The same reversal mechanism applies to interest (if an accrual was wrong, it can be reversed)
- Interest expense appears in the platform's financial statements
- The daily cron job at 1 AM processes all due accounts

---

## ADR-019: Savings History Signal — Pre-Computed Daily Snapshots

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Savings behavior metrics (consistency, stability, tenure, balance) are pre-computed daily and stored in `savings_history_signals` with one row per customer per day. Phase 6 (Loan Engine) reads the latest signal for credit scoring.

### Consequences
- Phase 6 has a fast, stable interface: `SELECT * FROM savings_history_signals WHERE customer_id = ? ORDER BY snapshot_date DESC LIMIT 1`
- Historical time-series data is available for trend analysis
- Three separate scores (consistency, stability, tenure) — Phase 6 weights them per its own rules
- The signal is a snapshot, not real-time — there may be a 24-hour lag

---

## ADR-020: Savings-First Eligibility — Configurable Multiplier with Logged Rationale

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
The "up to 3× savings balance" rule is implemented as a configurable `savings_multiplier` field on each loan product, not a hardcoded constant. The eligibility engine checks savings_balance × multiplier ≥ requested_amount, along with tenure, consistency, stability, and credit score thresholds — all per-product configurable. Every decision is logged with the full rationale in `loan_eligibility_decisions`.

### Consequences
- Different products can have different multipliers (Salary Loan: 3.0×, Agricultural: 2.5×)
- Admin can change the multiplier without a code deploy
- Every approval/denial is fully auditable — factors, values, thresholds, pass/fail
- Admin overrides are just as auditable as automated decisions (override_reason + override_by logged)

---

## ADR-021: Loan Accounting — Asset Accounts for Receivables

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Each loan gets its own asset account under parent 1002 (Loan Receivables). Disbursement: Debit Loan Receivable, Credit Wallet. Repayment: Debit Wallet, Credit Loan Receivable (principal) + Credit Interest Revenue (interest). Penalties: Debit Loan Receivable, Credit Fee Revenue.

### Consequences
- Loan receivables are correctly modeled as assets (the customer owes us money)
- Interest income is recognized when paid (cash basis for simplicity — accrual can be added later)
- Penalties increase the receivable (customer owes more) and recognize penalty income
- The balance sheet identity is maintained: Assets (1000 + 1002) = Liabilities (2000 + 2001) + Equity (3000)

---

## ADR-022: Repayment Split — Two Separate Orchestrator Calls

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Each loan repayment is split into two separate Orchestrator calls: one for principal (loan_repayment), one for interest (loan_interest). Each has its own journal entry and idempotency key.

### Consequences
- Each transaction is simple (one debit, one credit) — posting templates stay clean
- Customer sees transparent line items: "Principal repayment" and "Interest payment"
- The Orchestrator doesn't need to handle split amounts — each call has a single amount
- Two wallet_transactions entries per repayment (one debit for principal, one for interest)

---

## ADR-023: Default as State Transition — Not Deletion

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
When a loan defaults, its status transitions to 'defaulted' and all history remains fully traceable. No records are deleted or obscured. The customer's risk profile is updated (defaulted_loans += 1, risk_level → 'high' or 'restricted'). The loan record remains queryable for audit, reporting, and potential future recovery.

### Consequences
- Defaults are auditable — the full lifecycle from application to default is preserved
- Risk profile feeds back into the eligibility engine — defaulted customers face higher barriers
- 'restricted' risk level (2+ defaults) prevents new loan applications entirely
- The loan can still receive repayments after default (recovery payments)

---

## ADR-024: Governance Audit Trail — Append-Only Hash-Chained Log

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Governance actions (elections, votes, resolutions, meetings) are logged in a separate `governance_audit_log` table that is append-only (no UPDATE/DELETE, enforced by triggers) and hash-chained (SHA-256) for tamper-evidence. This is separate from the financial audit trail (Ledger) and the general operational audit (audit_log).

### Consequences
- Governance history is immutable — corrections are new records referencing the original
- Hash chaining provides tamper-evidence — any modification would break the chain
- Governance audit is queryable independently from financial audit
- Three audit systems: Ledger (financial), audit_log (operational), governance_audit_log (governance)

---

## ADR-025: Group Pool as Liability Account Under 2005

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Each group savings account gets its own liability ledger account under parent 2005 (Group Savings Pools). Contributions: Debit Wallet, Credit Pool. Payouts: Debit Pool, Credit Wallet. All through the Orchestrator.

### Consequences
- Group pool balances are derived from the Ledger — never written directly
- The same Orchestrator/Ledger path used for all other financial movements
- Pool balance = credits - debits for the pool's liability account
- The balance sheet identity is maintained: Assets = Liabilities + Equity

---

## ADR-026: Esusu Rotation — Orchestrator for All Payouts

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Esusu rotation payouts are processed through the Orchestrator like any other financial transaction. The `processNextPayout()` function calls `initiate()` with `group_payout` transaction type, which posts: Debit Group Pool, Credit Recipient Wallet.

### Consequences
- Every Esusu payout has a full audit trail in the Ledger
- Payouts are idempotent (keyed by `esusu_payout:{groupId}:cycle{N}`)
- Failed payouts are recorded as 'failed' and can be retried
- The pool is never directly manipulated — all movements through the Orchestrator

---

## ADR-027: Cooperative Participation Signal — Pre-Computed Daily Snapshots

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Cooperative participation metrics (membership status, tenure, meeting attendance, voting rate, group savings consistency, executive position) are pre-computed daily and stored in `cooperative_participation_signals`. Phase 6's eligibility engine reads the latest signal.

### Consequences
- Phase 6's CooperativeParticipation contract is fulfilled with real data (replacing the stub)
- The signal is a snapshot — may lag by 24 hours (same pattern as Phase 5's savings signals)
- Participation score (0-100) is computed from 6 components, all auditable
- The contract matches exactly: {status, cooperative_id, membership_tenure_days, participation_score}

---

## ADR-028: Configurable Governance — Per-Cooperative, Not Global

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Governance structures (executive positions, committees, voting rules, meeting frequency) are configurable per cooperative, not hardcoded to a single set of bylaws. Each cooperative defines its own positions, voting quorum, pass percentage, and meeting frequency in its `config` field.

### Consequences
- Different cooperatives can have different governance structures
- A cooperative can add/remove executive positions without code changes
- Voting thresholds are per-cooperative configurable
- The platform supports diverse cooperative types (agricultural, trade, community)

---

## ADR-029: Investment Settlement as Liability (2003)

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Investment settlement accounts are liabilities under parent 2003. Each investment account gets its own child account: 2003.INV-ACC-XXXXXX. Subscriptions: D Wallet, C Investment Settlement. Redemptions: D Investment Settlement, C Wallet. Returns: D Interest Expense, C Wallet/Settlement.

### Consequences
- Investment balances are derived from the Ledger — never written directly
- The same Orchestrator/Ledger path used for all other financial movements
- Returns are recognized as an expense (Interest Expense 5000), consistent with savings interest
- Auto-reinvest adds to the investment settlement account without touching the wallet

---

## ADR-030: Permanent Risk Disclosure Storage

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Risk disclosure acceptances are permanently stored in a dedicated `risk_disclosure_acceptances` table. Each record captures the full disclosure text, version, product name, risk level, IP address, and user agent at the time of acceptance. Records are never deleted or modified — they are permanent legal evidence.

### Consequences
- Even if the product's disclosure text changes, the original acceptance record preserves the exact text the customer agreed to
- The investment account has a DB-level CHECK constraint preventing activation without disclosure acceptance
- IP address and user agent provide additional audit trail for regulatory compliance
- Version tracking enables legal teams to determine which disclosure version each customer accepted

---

## ADR-031: Investment Terms Snapshot at Subscription

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
When a customer subscribes to an investment product, the product's current terms (rate, fees, lock periods, features) are captured in a `terms_snapshot` JSONB column on the investment account. Subsequent product configuration changes do not retroactively affect existing accounts.

### Consequences
- Admin can change product rates/fees without breaking existing investments
- Each account has a permanent record of the terms it was opened under
- Disputes can be resolved by referencing the terms snapshot
- Same pattern as Phase 5's savings account terms snapshot

---

## ADR-032: Returns Through Orchestrator — Payout and Reinvest

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Investment returns go through the Orchestrator with two paths: `investment_returns` (paid to wallet: D Interest Expense, C Wallet) and `investment_reinvest` (reinvested: D Interest Expense, C Investment Settlement). Both are proper double-entry postings with audit trails.

### Consequences
- All return movements are auditable in the Ledger
- Auto-reinvest doesn't touch the wallet — the returns stay in the investment
- Returns are recognized as an expense, consistent with savings interest and the accounting model
- Daily cron at 9 AM processes returns for all active investment accounts

---

## ADR-033: Return Guarantee Distinction (Fixed vs. Variable Pool)

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Every investment product has a `return_guarantee` field: 'guaranteed' (contractually fixed), 'expected' (target rate, not contractual), or 'variable_pool' (returns depend on actual pool performance). Products with 'variable_pool' must never display their expected_return_rate as guaranteed. The daily returns cron skips variable_pool products — their returns come from admin-entered pool performance records.

### Consequences
- Customers see honest return projections — guaranteed products show guaranteed rates, pool products show "expected" with clear disclosure
- The data model itself enforces the distinction — no UI or copy can imply a guaranteed return on a variable product
- The system uses two different return mechanisms: formula-based (guaranteed/expected) vs. pool-performance-based (variable_pool)
- Phase 9 reporting must represent both types honestly — not sum them into one "investment returns" number

---

## ADR-034: Pool Performance Data Source — Manual Admin Entry

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Pool performance data is entered manually by admin staff through the `recordPoolPerformance()` function. Each entry captures who entered it, when, the performance figures, and a source description (e.g., "crop sales completed"). There is no automated data feed — this is financial data driving payouts to multiple people, and it must be traceable to a human decision-maker.

### Consequences
- Every performance entry has a full audit trail (entered_by, entered_at, source_description, source_reference)
- Future automated feeds (crop yield APIs, market prices) would feed into the same interface — no module redesign needed
- Distribution cannot happen without a performance entry — the system never fabricates performance figures
- Admin staff are responsible for the accuracy of performance data — this is a governance decision, not a technical one

---

## ADR-035: Pool Distribution Through Orchestrator

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Pool distributions go through the Orchestrator with the same posting templates as individual returns: `investment_returns` (payout to wallet) or `investment_reinvest` (reinvest into investment settlement). Each contributor's distribution is a separate Orchestrator call with its own idempotency key.

### Consequences
- Every pool distribution is a proper double-entry posting with audit trail
- Proportional share is calculated as contributor's current_value / total_pool_value
- Distribution type (payout vs. reinvest) is per-account, based on the account's auto_reinvest setting
- If one contributor's distribution fails (e.g., no wallet), the others still succeed — partial distribution is logged
- The performance record tracks total_distributed vs. net_distributable for reconciliation

---

## ADR-036: Reporting as Read-Only Consumer (No Alternate Source of Truth)

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Reporting modules query existing sources of truth (Ledger, module tables) in real-time or on-demand. No aggregated/reporting table becomes an alternate source of truth. The `reporting_snapshots` table stores daily metrics for trend analysis but is explicitly marked as derived and rebuildable.

### Consequences
- Every figure in a report can be reconstructed from the Ledger or originating module data
- The `reporting_snapshots` table is NOT a source of truth — it's a performance optimization for trend analysis
- If snapshots drift from source data, the snapshots are wrong, not the source data
- Compliance reports query the Ledger directly, never the snapshots table

---

## ADR-037: Aggregation Strategy — Real-Time for Operational, On-Demand for Compliance

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Operational dashboards use real-time queries (acceptable staleness: seconds). Compliance/regulatory reports use on-demand generation (must be point-in-time accurate). Risk reports use on-demand (must be auditable). Audit log viewer uses real-time (needed for incident response).

### Consequences
- Operational dashboards are fast but may show slightly stale data (acceptable for day-to-day monitoring)
- Compliance reports are generated on-demand with full traceability documentation
- For production at 1M users, operational dashboards would switch to 5-15 min materialized views
- The `reporting_snapshots` table provides historical trend data (daily snapshots) without being a real-time source

---

## ADR-038: Admin Action Audit Trail

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Every admin console action (config change, RBAC change, override) is logged in `admin_action_log` with: admin_user_id, admin_role, action, action_category, entity_type, entity_id, before_state, after_state, result, source_ip, user_agent. This is the same rigor as customer-facing financial actions.

### Consequences
- Admin actions are fully auditable — who did what, when, what changed
- Before/after state captures the full impact of config changes
- Source IP and user agent provide additional audit trail
- Admin action log is queryable through the audit viewer API

---

## ADR-039: Investment Reporting Separates Guaranteed from Variable Returns

**Date:** 2026-07-28  
**Status:** Accepted  

### Decision
Investment pool performance reports show guaranteed, variable_pool, and expected returns in SEPARATE sections. They are never blended into a single misleading aggregate. The report includes an explicit warning against summing them without clear labeling.

### Consequences
- Reports honestly represent the risk/return profile of different product types
- A compliance officer or auditor can see exactly which returns are contractual vs. performance-based
- Future reporting phases must maintain this separation

---

## ADR-040: Email OTP Replaces Password-Based Authentication

**Date:** 2026-07-30  
**Status:** Accepted  

### Decision
Password-based authentication is removed entirely. All customer and staff sign-in uses Email OTP (Supabase `signInWithOtp`). No password field exists anywhere in the UI or API.

**Configuration values:**
- OTP code length: 6 digits
- OTP expiry: 10 minutes (600 seconds)
- OTP resend rate limit: 60 seconds between requests (client-enforced)
- OTP is single-use: invalidated after successful verification or expiry
- `shouldCreateUser: false` on login (prevents account creation from login screen)
- `shouldCreateUser: true` on signup (creates account on OTP verification)

### Consequences
- No password storage, no password reset flows, no password-related security surface
- Existing users with passwords in Supabase can still sign in via OTP (passwords remain in the DB but are simply unused — no migration needed)
- Staff/admin also use Email OTP (deliberate decision — same login page, redirects to `/admin/dashboard`)
- Google OAuth provider fully disabled in Supabase and all related code removed

---

## ADR-041: 4-Digit PIN for Device-Bound Fast Sign-In

**Date:** 2026-07-30  
**Status:** Accepted  

### Decision
A 4-digit PIN provides fast re-authentication on a device that has already completed Email OTP. The PIN is **device-bound, not identity-bound**: it unlocks a stored, still-valid Supabase session on a recognized device — it does NOT independently mint a new authenticated session.

**Configuration values:**
- PIN length: 4 digits
- PIN max failed attempts: 5 (after 5, PIN is locked → force Email OTP)
- PIN hashing: PBKDF2, 10,000 iterations, SHA-256, per-row 16-byte salt
- PIN storage: `device_pins` table (migration 00034), RLS-enabled
- Device identification: UUID stored in `localStorage` (`agriqcap_device_id`)
- PIN setup: optional, offered after first successful Email OTP on a device
- PIN can only refresh an existing session (`supabase.auth.refreshSession()`) — if the session's refresh token has expired, PIN is useless and the user must do Email OTP again
- "Use email instead" link always visible on PIN entry screen — clears device PIN and redirects to email OTP

### Consequences
- PIN is a convenience layer, not a security gate — the session expiry (Supabase default: 30 days for refresh token) is the real security boundary
- After 30 days of inactivity, all users must re-authenticate via Email OTP regardless of PIN
- If a user clears browser data, the device_id is lost and PIN is unavailable (correct behavior)
- If a user gets a new device, they must do Email OTP and set up a new PIN on that device
- Lockout after 5 failed attempts is per-device (not per-account), preventing brute-force while allowing the user to sign in via Email OTP on the same device

---

## ADR-042: Google Sign-In Fully Removed

**Date:** 2026-07-30  
**Status:** Accepted  

### Decision
Google OAuth provider is disabled in Supabase Auth (client_id and secret cleared). All Google-related code is deleted: GoogleButton component, /auth/callback route, Divider component, Google-specific bootstrap logic. Google redirect URIs are no longer registered in Google Cloud Console (provider disabled).

### Consequences
- No dead code paths for a disabled provider
- `signup_method` enum on customers table retains 'google' value for historical records but no new records will use it
- Signup is exclusively via Email OTP (manual registration: name + email + phone)
