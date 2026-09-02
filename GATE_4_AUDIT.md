# GATE 4 AUDIT — Accounts, Transactions & Money Movement

**Date:** September 3, 2026
**Mode:** READ-ONLY AUDIT (no code modified)
**Scope:** Accounts, account provisioning, balances, transactions, transfers, beneficiaries, webhooks, idempotency, reconciliation, background jobs, frontend/API layer, security
**Baseline:** Gates 1–3 complete (commit b716699), production live at agriqcap.vercel.app

---

## 1. CURRENT IMPLEMENTATION

The platform already implements a substantial portion of the Gate 4 target architecture:

- **Anti-Corruption Layer (ACL)** — `SafeHavenAdapter` implements `IBankingProvider`; raw Safe Haven types never leak to the domain layer (`src/modules/integrations/types.ts` is vendor-agnostic).
- **Financial Transaction Orchestrator (FTO)** — 23 transaction types, state machine (`initiated → validated → posting → posted → completed/failed`), idempotency checked at step 1, deterministic posting templates for every money-movement type.
- **Double-Entry Ledger** — `journal_entries`/`journal_lines` are INSERT-only (DB triggers), `post_journal_entry()` enforces zero-sum under `FOR UPDATE` row lock, reversals create counter-entries rather than edits.
- **Two-Phase Withdrawal Framework** — reserve (Wallet→Escrow 2004) → settle (Escrow→SH Settlement 1000) or reverse. Webhook + cron reconciliation for stalled transfers.
- **Webhook Pipeline** — `inbound_events` landing zone (append-only, unique on `(source, external_event_id)`), token-query-param auth, API re-verification of incoming credits, idempotent credit processing with unmatched-credit quarantine.
- **Reconciliation** — daily 2AM cron comparing internal consistency (cached vs computed) and external consistency (ours vs Safe Haven `GET /accounts/{id}`); discrepancies → `reconciliation_flags`, NEVER auto-corrected.
- **Accounts** — `wallets` (with DVA fields, cached balances, limits, restrictions), `safe_haven_accounts` (UNIQUE per customer), provisioning flow KYC→sub-account→wallet link with auto-repair and non-blocking failure handling.
- **Beneficiaries** — table (Gate 2) with RLS ownership policies, CRUD API routes with 10-digit validation and duplicate checks.
- **Background jobs** — 8 crons, all CRON_SECRET authenticated, most idempotent via deterministic date/reference keys.

---

## 2. WORKING (Verified — Do Not Break)

| # | Area | Evidence |
|---|------|----------|
| 1 | `wallets` schema (DVA fields, cached balances, limits, CHECK constraints, RLS) | `00007_wallets.sql` L61–125 |
| 2 | `safe_haven_accounts` (UNIQUE(customer_id) prevents duplicate provisioning) | `00037_safe_haven_provisioning.sql` L28–44 |
| 3 | KYC → DVA provisioning flow with duplicate/failed/outage handling | `provisioning/identity/validate/route.ts`, adapter L69–155 |
| 4 | Account numbers always from Safe Haven in production (never locally generated) | `adapter.ts` L130–155; mock only when credentials absent |
| 5 | `financial_transactions` FTO table (unique idempotency key, self-referencing reversals, RLS) | `00014_financial_transactions.sql` |
| 6 | `wallet_transactions` append-only read model (unique per source_event_id) | `00010_wallet_transactions.sql` L26–250 |
| 7 | Ledger immutability (INSERT-only triggers, zero-sum `post_journal_entry()`) | `00013_journal_entries.sql` L155–315 |
| 8 | FTO orchestrator: 23 types, posting templates, idempotency at initiation | `src/modules/orchestrator/` |
| 9 | Two-phase withdrawal lifecycle (reserve→settle/reverse) | `src/modules/withdrawal/service.ts` |
| 10 | Withdrawal idempotency (`withdrawal_requests.idempotency_key UNIQUE` + adapter wrapper) | `00038_withdrawal_infra.sql` L111 |
| 11 | Name enquiry via Safe Haven (`/transfers/name-enquiry`) | `adapter.ts` L194–207 |
| 12 | Beneficiaries table + CRUD + RLS ownership | `00042_fix_fks_and_beneficiaries.sql`, `/api/beneficiaries` |
| 13 | Incoming credit processing: match→FTO→ledger→read model, unmatched quarantine | `src/modules/wallet/incoming-credit.ts` |
| 14 | Webhook deduplication (unique external_event_id) and append-only event storage | `00008_inbound_events.sql` |
| 15 | Reconciliation flags (never auto-correct) + daily cron | `00011`, `src/modules/wallet/reconciliation.ts` |
| 16 | OAuth error sanitization, header redaction, BVN/NIN log scrubbing | `auth.ts` L374–438, `client.ts` L273–308 |
| 17 | Health check endpoint (2-step OAuth + GET /accounts, sanitized output) | `integrations/safehaven/health/route.ts` |
| 18 | ACL: zero raw Safe Haven types in domain layer; zero frontend→Safe Haven calls | `types.ts`, frontend grep |
| 19 | Frontend transaction history (real data, date/direction/search filters, CSV/PDF export) | `statements/page.tsx` |
| 20 | DB precision: all money columns `numeric(15,2)`/`(18,2)`, `amount > 0` CHECK constraints | all financial migrations |
| 21 | All 8 crons CRON_SECRET authenticated | `/api/cron/*` |
| 22 | 11/12 financial API routes check auth + ownership | see Security section |

---

## 3. PARTIAL (Functional but Incomplete)

| # | Area | Gap | Evidence |
|---|------|-----|----------|
| 1 | FTO transaction states | Missing `CANCELLED` in DB enum and TS types; PRD `PENDING`/`PROCESSING` covered only by granular states (`pending_settlement`, `transfer_submitted`) | `00014` L29–37 vs PRD §4.6 |
| 2 | Direct transfer flow (`/api/transfers`) | Single-phase immediate wallet debit on provider acceptance — no escrow reservation, no automatic reversal if NIBSS-level failure occurs later; error in ledger debit after provider success is logged but not reconciled | `transfers/route.ts` L80–110 |
| 3 | Wallet deposit flow | Production path (webhook) is correct, but sandbox bypass allows unauthenticated-value manual self-funding outside production | `deposit/route.ts` L105–135 |
| 4 | Reconciliation source of truth | Computes "our balance" from `wallet_transactions` sum — NOT from the Ledger — despite migration 00015 declaring Ledger as SoFR; internal-consistency check can diverge from ledger authority | `reconciliation.ts` L57–121 |
| 5 | Reconciliation coverage | Detects balance mismatches only; no per-transaction comparison (missing/duplicate/amount-mismatch transactions) against Safe Haven statement; no `GET /accounts/{id}/statement` integration | PRD §4.11 |
| 6 | Webhook reliability fields | `inbound_events` has processing_attempts + correlation_id, but NO payload_hash; no RETRYING status flow — failed events stay `processing_failed` with no retry worker | `00008_inbound_events.sql` vs PRD §4.10 |
| 7 | Withdrawal page bank list | Hardcoded static array of 24 banks instead of fetching `/api/banks` (transfer page does fetch dynamically) | `wallet/withdraw/page.tsx` L38 |
| 8 | Balance UI labeling | Available/ledger/pending/reserved distinguished + refresh button present, but no "as of" sync timestamp shown; `cached_balance_updated_at` exists in API but unused in UI | `wallet/page.tsx` L160–203 |
| 9 | Cron failure handling | Per-item try/catch in batch loops — partial batches persist without transactional rollback (acceptable for idempotent re-runs, but flagged) | accrue/overdue/payout crons |
| 10 | PII scrubbing breadth | BVN/NIN/number scrubbed from `safe_haven_api_calls`, but `phoneNumber`, `email`, `dateOfBirth` remain in raw request/response bodies | `client.ts` L289–308 |

---

## 4. MISSING

| # | Item | PRD Ref |
|---|------|---------|
| 1 | Safe Haven `GET /accounts/{id}/statement` integration (authoritative transaction history for reconciliation) | §4.11, §14 |
| 2 | Safe Haven `GET /transfers` (transfer history query) | §4.6 |
| 3 | Transaction-level reconciliation (missing/duplicate/amount-mismatch transaction detection vs Safe Haven) | §4.11 |
| 4 | Webhook payload hash storage | §4.10 |
| 5 | Webhook RETRYING state + retry worker for `processing_failed` events | §4.10 |
| 6 | `CANCELLED` FTO state | §4.6 |
| 7 | Concurrency guard (SELECT FOR UPDATE / advisory lock) on wallet balance check before transfer submission | PRD §3.6, §10.5 |
| 8 | `/api/banks` authentication | §4.8 security requirements |

---

## 5. MOCK (Confined — Activation Conditions Documented)

| # | Item | Risk | Activation Condition |
|---|------|------|---------------------|
| 1 | `SafeHavenMockAdapter` (`mock.ts`) | Fabricated transfers/balances/accounts if activated in production | Factory returns mock ONLY when `SAFEHAVEN_CLIENT_ID` or `SAFEHAVEN_PRIVATE_KEY` absent. Production has both set → real adapter active. **Residual risk: no hard environment guard — mock activates silently on credential loss.** |
| 2 | Sandbox deposit bypass | Manual wallet self-funding without provider money | Gated by `isSandbox` (`SAFE_HAVEN_ENV === 'mock'` or non-production URL). Production check returns 403. **Residual risk: depends on env flag correctness, not a hard server guard.** |
| 3 | Hardcoded bank metadata in adapter | `bankName: 'Safe Haven MFB'`, `bankCode: '999240'` filled because Safe Haven's sub-account response omits them | Static values, documented reason, low risk |

**Note:** `SAFE_HAVEN_ENV=mock` IS set in production Vercel env (per env var audit) while `SAFEHAVEN_*` production credentials are also set. The factory prioritizes real credentials, but this mixed configuration is a live foot-gun — see Security Risks.

---

## 6. BROKEN / CONFIGURATION DEFECTS

| # | Item | Impact | Evidence |
|---|------|--------|----------|
| 1 | Dual OAuth implementations | `auth.ts` (webhook + health consumers) and `client.ts` (all domain operations) maintain separate token caches and separate JWT signers. Cache invalidation in one does not affect the other → duplicate OAuth handshakes, rate-limit exposure on `/oauth2/token` | `auth.ts` L87–454 vs `client.ts` L40–171 |
| 2 | `.env.local` syntax defect | `# Safe Haven OAuth (Sandbox)SAFEHAVEN_CLIENT_ID=...` — comment and variable on one line → variable commented out locally → mock provider activates in local dev | `.env.local` L65 |
| 3 | Reconciliation env gate mismatch | External consistency check gates on `SAFE_HAVEN_API_KEY` + `SAFE_HAVEN_ENV !== 'mock'`. Production has `SAFE_HAVEN_ENV=mock` SET → **external Safe Haven comparison is currently SKIPPED in production**; only internal consistency runs | `reconciliation.ts` L121–124 |

---

## 7. SECURITY RISKS

| # | Risk | Severity | Evidence |
|---|------|----------|----------|
| 1 | Webhook fail-open: missing `SAFE_HAVEN_WEBHOOK_SECRET` → ALL webhook requests accepted | HIGH (mitigated: secret IS set in production) | `webhooks/safe-haven/route.ts` L48–51 |
| 2 | Webhook fail-open #2: Safe Haven re-verification API unavailable → credit accepted anyway with only a console warning | HIGH — provider outage converts webhook endpoint to trust-on-receipt | `webhooks/safe-haven/route.ts` L130–135 |
| 3 | Idempotency keys contain `Date.now()`/`Math.random()` on money-moving routes — every retry generates a NEW key, defeating deduplication | **CRITICAL** | `deposit/route.ts` L148 (`${Date.now()}`), `withdrawal/service.ts` L92, `transfers/route.ts` L78 (paymentReference) |
| 4 | Race condition: balance check via plain SELECT before provider call — two concurrent transfers can both pass and overdraw | HIGH | `transfers/route.ts` L68–74 |
| 5 | `/api/banks` unauthenticated — unauthenticated users can trigger provider bank-list calls | MEDIUM | `banks/route.ts` L5 |
| 6 | `SAFE_HAVEN_ENV=mock` set in production while real credentials also set — mixed signals; sandbox deposit bypass depends on this flag | MEDIUM | Vercel env audit |
| 7 | Phone/email/DOB unredacted in `safe_haven_api_calls` logs | MEDIUM | `client.ts` sanitize keys list |
| 8 | Direct transfer: provider success + ledger debit failure leaves orphaned external transfer with no reconciliation queue entry | HIGH | `transfers/route.ts` L81–110 |

---

## 8. DATA RISKS

| # | Risk | Evidence |
|---|------|----------|
| 1 | Reconciliation internal check uses `wallet_transactions` sum, not Ledger balance — diverges from the Ledger-as-SoFR architecture (00015); a ledger/wallet_transactions inconsistency would produce false or missed flags | `reconciliation.ts` L57–121 |
| 2 | No transaction-level reconciliation vs Safe Haven statement — missing/duplicate/delayed transactions undetectable at scale | PRD §4.11 unimplemented |
| 3 | Partial cron batch failures persist partial state (acceptable due to idempotent keys, but no batch-level resume marker) | accrue/overdue crons |
| 4 | Plaintext BVN/NIN columns retained alongside encrypted columns (deliberate backward-compat decision from Gate 3; eventual drop required for full at-rest protection) | `customers.bvn`, `customers.nin` |

---

## 9. SAFE HAVEN GAPS

| # | Endpoint | Status |
|---|----------|--------|
| 1 | `POST /oauth2/token` | Integrated (twice — see Broken #1) |
| 2 | `POST /identity/v2` + `/validate` | Integrated ✅ |
| 3 | `POST /accounts/v2/subaccount` | Integrated ✅ |
| 4 | `GET /accounts/{id}` | Integrated (reconciliation + balance) ✅ |
| 5 | `GET /transfers/banks` | Integrated ✅ (403 scope issue noted — provider-side) |
| 6 | `POST /transfers/name-enquiry` | Integrated ✅ |
| 7 | `POST /transfers` | Integrated ✅ |
| 8 | `POST /transfers/status` | Integrated ✅ |
| 9 | `GET /accounts/{id}/statement` | **NOT INTEGRATED** |
| 10 | `GET /transfers` (history) | **NOT INTEGRATED** |
| 11 | Webhook events: `account.credit` handled ✅; `transfer.completed/failed` handled ✅; `account.debit` stored (informational) ✅ (Gate 3); `virtualAccount.transfer` mapped but processing path is same as credit — **verify payload mapping** against real Safe Haven event shape |

---

## 10. DATABASE GAPS

1. `ft_status` enum: add `cancelled`.
2. `inbound_events`: add `payload_hash` column.
3. `inbound_events.processing_status`: no `retrying` status — add to enum (currently: received/processing/processed/processing_failed/failed/rejected — verify exact enum in 00008).
4. Reconciliation: consider adding per-transaction reconciliation records (missing_tx, duplicate_tx, amount_mismatch types to `reconciliation_flags.flag_type`).
5. No advisory-lock or SELECT FOR UPDATE helper exposed to API routes for balance reservation.
6. Plaintext `bvn`/`nin` columns: plan for drop after encrypted-column cutover is complete (BUSINESS DECISION for cutover timing).

---

## 11. API GAPS

1. `/api/banks` — add authentication.
2. `/api/transfers` — refactor to two-phase escrow pattern (reserve→settle) matching the withdrawal service; add reconciliation queue entry on ledger-debit-after-provider-success failure.
3. Idempotency keys on deposit/withdrawal/transfer — replace timestamp/random components with deterministic client-supplied references (require `idempotency_key` in request body per PRD §3.6).
4. No admin API to retry/replay failed `inbound_events`.
5. No Safe Haven statement endpoint exposure for admin reconciliation.
6. Balance refresh option: no user-facing "sync with bank" action calling `GET /accounts/{id}` (PRD §4.5 — "temporarily unavailable/synchronizing" states).

---

## 12. FRONTEND GAPS

1. Withdrawal page: replace hardcoded 24-bank array with `/api/banks` query (transfer page pattern).
2. Balance display: add last-synced timestamp (`cached_balance_updated_at`) near refresh button.
3. No explicit "synchronizing / temporarily unavailable" balance states (PRD §4.5).
4. Desktop right rail: hardcoded savings progress (65%) — needs real API (carried from Phase 10 gap list).

---

## 13. RECONCILIATION GAPS

1. **External comparison currently disabled in production** by `SAFE_HAVEN_ENV=mock` gate (Broken #3) — fix env gate to check real credential presence, not the legacy flag.
2. Balance source: switch internal check to Ledger-derived balance (per 00015 architecture).
3. No transaction-level statement reconciliation (needs `GET /accounts/{id}/statement`).
4. No discrepancy-resolution workflow API (flags can be created and listed but not resolved — carried from Phase 9 gap list).
5. Reconcile-all capped at 500 wallets — needs pagination for scale.

---

## 14. RECOMMENDED IMPLEMENTATION (Gate 4 plan, in priority order)

**P0 — Financial integrity (must fix before any new features):**
1. Fix idempotency key generation on all money-moving routes (deposit, withdrawal, transfers): deterministic keys from request body (client-supplied reference) or DB sequence, never `Date.now()`/`Math.random()`.
2. Refactor `/api/transfers` to two-phase escrow reservation (reuse `withdrawal/service.ts` pattern).
3. Add concurrency guard: SELECT FOR UPDATE on wallet row (or advisory lock) around balance check + reservation.
4. Fix reconciliation env gate (credential-presence check, not `SAFE_HAVEN_ENV`); repoint internal check to Ledger balance.
5. Close webhook fail-open #2: on re-verification API failure, mark event `processing_failed` (quarantine) instead of crediting.

**P1 — Safe Haven completeness:**
6. Integrate `GET /accounts/{id}/statement`; build transaction-level reconciliation comparing SH statement vs `wallet_transactions`.
7. Unify OAuth: refactor `client.ts` to consume `getSafeHavenAuthService()`.
8. Fix `.env.local` syntax defect; remove `SAFE_HAVEN_ENV=mock` from production Vercel env.

**P2 — Robustness:**
9. Add `cancelled` FTO state; add `payload_hash` + `retrying` status to `inbound_events`; add event retry worker (extend process-events cron).
10. Add auth to `/api/banks`; wire withdrawal page to `/api/banks`; add balance sync timestamp to UI.
11. Extend log scrubbing to phoneNumber/email/DOB.

**Deferred (with justification):**
- `GET /transfers` history endpoint — local `transfers` table suffices for MVP; statement reconciliation covers integrity.
- Plaintext BVN/NIN column drop — requires business decision on cutover timing.

---

## 15. DEPENDENCIES

- P0 item 6 (statement integration) requires Safe Haven API access to verify the real response shape of `GET /accounts/{id}/statement` (PRD §22: do not invent response structures).
- Webhook `virtualAccount.transfer` payload shape must be confirmed against a real Safe Haven event before trusting the mapping.
- The `/api/transfers` refactor must not regress the withdrawal flow (shared orchestrator templates).

---

## 16. BUSINESS DECISIONS REQUIRED

1. **Idempotency contract:** Should the mobile/web clients generate and resend a client-side idempotency reference on retries (recommended), or should the server derive keys deterministically from request parameters? (Affects client API contracts.)
2. **Webhook quarantine policy:** When Safe Haven's re-verification API is down, should incoming credits be (a) quarantined for later processing (recommended, safe), or (b) credited with a review flag (current behavior)? This affects real-time funding UX vs safety.
3. **Direct transfer vs withdrawal unification:** Should `/api/transfers` remain a separate product surface, or should all outbound money movement consolidate into the withdrawal lifecycle?
4. **Plaintext BVN/NIN retention:** Confirm timeline for dropping plaintext columns now that encrypted columns are populated.
5. **Statement reconciliation cadence:** Daily (with the 2AM cron) or per-transaction on webhook? (Cost/latency trade-off.)

---

## 17. ACCEPTANCE CRITERIA (Gate 4 pass conditions — from PRD §4.12, mapped to findings)

| Criterion | Current Status |
|---|---|
| Real Safe Haven accounts display correctly | ✅ PASS |
| Account provisioning is reliable (dupes, failures, retries) | ✅ PASS |
| Balances correctly sourced | ⚠️ PARTIAL — external reconciliation disabled in prod by env gate |
| Transactions correctly persisted | ✅ PASS |
| Transfers cannot duplicate | ❌ FAIL — timestamp/random idempotency keys |
| Beneficiaries work securely | ✅ PASS (add /api/banks auth) |
| Incoming transfers processed | ✅ PASS (fail-open hardening needed) |
| Webhooks idempotent | ✅ PASS (dedup verified) |
| Failed transactions handled | ✅ PASS (withdrawals) / ❌ FAIL (direct transfers) |
| Reversed transactions handled | ✅ PASS (ledger counter-entries) |
| Reconciliation detects discrepancies | ⚠️ PARTIAL — internal only, wrong source-of-truth, external disabled |
| Financial operations have audit trails | ✅ PASS |
| Gates 1–3 remain functional | ✅ PASS (64/64 tests, TS clean) |
| Automated tests pass | ✅ PASS |
| Production smoke tests pass | ✅ PASS |

**Gate 4 cannot pass until the 3 ❌ items (transfer idempotency, direct-transfer failure handling, concurrency guard) and the reconciliation env-gate fix are remediated.**

---

*End of Gate 4 Audit. No code was modified during this audit. Awaiting review and approval before implementation begins.*
