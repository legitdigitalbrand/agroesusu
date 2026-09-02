# AgriQCap — Safe Haven Integration Map (Read-Only Audit)
**Date:** September 2, 2026
**Audit Type:** Read-Only Code & Architecture Audit (No Modifications)
**Production URL:** https://agriqcap.vercel.app
**Safe Haven Mode:** PRODUCTION (live API)

---

## 1. Safe Haven API Capability vs AgriQCap Implementation

| Capability | Safe Haven API | AgriQCap Implementation | Status |
|------------|---------------|------------------------|--------|
| OAuth2 Authentication | POST /oauth2/token (RS256 JWT) | ✅ Implemented (auth.ts + client.ts) — dual implementations | WORKING (duplicated) |
| Account Creation (Individual) | POST /accounts/v2/subaccount | ✅ Implemented (adapter.ts → client.ts) | WORKING |
| Account Creation (Corporate) | POST /accounts/v2/subaccount/corporate | ❌ NOT IMPLEMENTED | MISSING |
| Account List | GET /accounts | ✅ Used in health check only | PARTIAL |
| Account Details | GET /accounts/{id} | ✅ Used in reconciliation only | PARTIAL |
| Account Settings Update | PUT /accounts/{id} | ❌ NOT IMPLEMENTED | MISSING |
| Balance Enquiry | GET /accounts/{id} → accountBalance, bookBalance | ✅ Used in reconciliation cron only. User UI uses cached balance. | PARTIAL |
| Transaction Statement | GET /accounts/{id}/statement | ❌ NOT IMPLEMENTED | MISSING |
| Transfer History | GET /transfers | ❌ NOT IMPLEMENTED | MISSING |
| Bank List | GET /transfers/banks | ❌ NOT IMPLEMENTED | MISSING |
| Name Enquiry | POST /transfers/name-enquiry | ✅ Implemented (adapter.ts) | WORKING |
| Transfer Execution | POST /transfers | ✅ Implemented (adapter.ts) | WORKING |
| Transfer Status Query | POST /transfers/status | ✅ Implemented (adapter.ts) | WORKING |
| Beneficiaries List | GET /transfers/beneficiaries | ❌ NOT IMPLEMENTED | MISSING |
| Beneficiary Delete | DELETE /transfers/beneficiaries/{id} | ❌ NOT IMPLEMENTED | MISSING |
| Identity Verification (BVN) | POST /identity/v2 + /identity/v2/validate | ✅ Implemented (2-step OTP flow) | WORKING |
| Identity Verification (NIN) | POST /identity/v2 + /identity/v2/validate | ✅ Implemented | WORKING |
| Identity Verification (vNIN) | POST /identity/v2 | ❌ NOT IMPLEMENTED | MISSING |
| Identity Verification (BVNUSSD) | POST /identity/v2 | ❌ NOT IMPLEMENTED | MISSING |
| Identity Verification (vID) | POST /identity/v2 | ❌ NOT IMPLEMENTED | MISSING |
| Webhook: account.credit | event_type: account.credit | ✅ Handled (incoming credit processing) | WORKING |
| Webhook: account.debit | event_type: account.debit | ❌ NOT HANDLED | MISSING |
| Webhook: virtualAccount.transfer | event_type: virtualAccount.transfer | ❌ NOT HANDLED | MISSING |
| Bill Payments (VAS) | POST /vas/pay/* | ❌ NOT IMPLEMENTED | MISSING |
| Idempotency | Client-defined paymentReference/externalReference | ✅ DB-backed (idempotency_keys table) | WORKING |

---

## 2. Critical Security Findings

### 🔴 CRITICAL: BVN/NIN Exposed Unmasked in API Responses
- **Location:** `src/app/api/me/route.ts` lines 174-175
- **Issue:** `bvn: customer.bvn` and `nin: customer.nin` returned in raw plaintext to browser
- **Risk:** Any XSS or browser extension can extract full 11-digit BVN/NIN
- **Fix Required:** Mask BVN/NIN (e.g., `******1234`) before returning to client

### 🔴 CRITICAL: Client-Side KYC Bypass
- **Location:** `src/app/(auth)/onboarding/page.tsx` lines 70-90
- **Issue:** Onboarding writes BVN/NIN directly to `profiles` table via client-side Supabase SDK, completely bypassing Safe Haven OTP verification
- **Risk:** Users can self-verify with any arbitrary 11-digit string
- **Fix Required:** Route ALL identity verification through `/api/provisioning/identity` + `/api/provisioning/identity/validate`

### 🔴 CRITICAL: BVN/NIN Stored in Plaintext (No Encryption)
- **Tables:** `customers.bvn`, `customers.nin`, `profiles.bvn`, `profiles.nin`, `safe_haven_identity_verifications.number`
- **Issue:** No column-level encryption (pgcrypto, KMS, or AES-GCM)
- **Risk:** Database breach exposes all customer identity numbers
- **Fix Required:** Apply column-level encryption for PII fields

### 🟠 HIGH: Raw Provider Errors Leaked to Client
- **Location:** `src/modules/integrations/safe-haven/client.ts` lines 109, 259
- **Issue:** `throw new Error(JSON.stringify(responseBody))` — raw Safe Haven API errors forwarded to client
- **Risk:** Leaks internal API structure, error codes, and potentially sensitive data
- **Fix Required:** Sanitize errors in client.ts (like auth.ts already does)

### 🟠 HIGH: BVN/NIN Logged Unsanitized in Database
- **Location:** `src/modules/integrations/safe-haven/client.ts` lines 282-297
- **Issue:** `request_body` containing plaintext BVN/NIN saved to `safe_haven_api_calls` table
- **Risk:** Audit trail becomes a PII exposure vector
- **Fix Required:** Scrub `number`, `bvn`, `nin` fields from log payloads before DB insert

### 🟡 MEDIUM: SUPABASE_ANON_KEY Fallback in Adapter
- **Location:** `src/modules/integrations/safe-haven/adapter.ts` line 293
- **Issue:** Falls back to anon key if service role key is missing — RLS would block writes
- **Fix Required:** Require service role key, fail loudly if missing

### 🟡 MEDIUM: API Routes Leak error.message to Client
- **Location:** Multiple API routes (e.g., `src/app/api/provisioning/identity/route.ts` lines 93-97)
- **Issue:** `error.message` passed directly in 500 responses
- **Fix Required:** Return generic error messages, log detailed errors server-side

---

## 3. Architecture Findings

### Dual Authentication Implementation (Architectural Duplication)
- `auth.ts` (SafeHavenAuthService): Hardened, single-flight locking, error sanitization, log filtering
- `client.ts` (SafeHavenClient): Re-implements OAuth independently, no single-flight, leaks raw errors
- **These two do NOT share code.** Health check uses auth.ts; operational banking uses client.ts via factory.ts
- **Recommendation:** Refactor client.ts to use auth.ts for token acquisition

### Environment Variable Inconsistency
Two parallel sets of env vars:
- auth.ts: `SAFEHAVEN_CLIENT_ID`, `SAFEHAVEN_PRIVATE_KEY`, `SAFEHAVEN_API_URL`
- factory.ts: `SAFE_HAVEN_API_KEY`, `SAFE_HAVEN_SECRET_KEY`, `SAFE_HAVEN_ENV`, `SAFE_HAVEN_IBS_CLIENT_ID`
- **Risk:** Misconfiguration leads to mock mode silently activating
- **Recommendation:** Unify to single naming convention

### Legacy Mock Stub Still Present
- `src/lib/safe-haven/index.ts` — always returns MockSafeHavenClient, has TODO at line 87
- Not connected to the production module at `src/modules/integrations/safe-haven/`
- **Recommendation:** Delete this legacy file

### Balance Architecture (PRD-Compliant)
- User-facing balances are CACHED (`wallets.cached_available_balance`, `cached_ledger_balance`)
- Cache is updated by: webhook events → orchestrator → ledger → wallet cache refresh
- Safe Haven `GET /accounts/{id}` is called ONLY by reconciliation cron (not user UI)
- **This is correct per PRD Section 10** — balances are not fake, they're reconciled cached values
- Gap: No real-time balance refresh option for users who want to verify against Safe Haven

### Idempotency (Properly Implemented)
- DB-backed via `idempotency_keys` table in adapter.ts
- Key format: `operation:entityId:sha256(params).slice(0,16)`
- Covers: identity verification, sub-account creation, transfers
- Status tracking: completed (returns cached), in_progress (blocks), failed (allows retry)
- **This satisfies PRD Section 13 requirements**

### Webhook Security
- Safe Haven does NOT sign webhooks (no HMAC)
- Implementation uses `?token=SAFE_HAVEN_WEBHOOK_SECRET` query parameter + API re-verification
- Event deduplication via `inbound_events.external_event_id`
- **This satisfies PRD Section 14 requirements**
- Gap: Only `account.credit` is handled. `account.debit` and `virtualAccount.transfer` are ignored

### Double-Entry Ledger (PRD-Compliant)
- Chart of accounts: 15 system accounts (1000-5001)
- Zero-sum enforced at DB level via `post_journal_entry()` function
- Posted journal entries are immutable (trigger prevents mutation)
- Account balances auto-updated on posting
- **This satisfies PRD Section 3 (most important rule) — no fake balances**

### Missing: Beneficiaries Table
- No standalone beneficiaries table in database
- Beneficiary data stored inline on `withdrawal_requests` and `wallet_transactions`
- PRD Section 36 expects a `beneficiaries` table
- **Recommendation:** Create `beneficiaries` table and wire to Safe Haven's beneficiary API

### Missing: Maker-Checker (Dual Approval)
- Loan approvals can be done by single staff member
- No second-person confirmation state in schema
- PRD Section 33 requires maker-checker for sensitive operations
- **Recommendation:** Add `approval_status` (pending_maker → pending_checker → approved) for sensitive admin actions

### Missing: Transaction Statement from Safe Haven
- Safe Haven provides `GET /accounts/{id}/statement` for authoritative transaction history
- AgriQCap only uses internal `wallet_transactions` table
- No cross-referencing with Safe Haven's statement endpoint
- **Recommendation:** Implement periodic statement reconciliation against Safe Haven's transaction history

---

## 4. Database Schema Assessment

### Internal vs External ID Mapping (PRD Section 37)
| Entity | Internal ID | Safe Haven Reference | Status |
|--------|-------------|---------------------|--------|
| Customer | `customers.id` (UUID) | `customers.safe_haven_customer_id` (TEXT) | ✅ Mapped |
| Account | `wallets.id` (UUID) | `wallets.safe_haven_account_id` (TEXT) | ✅ Mapped |
| Account Number | `wallets.account_number` | `safe_haven_accounts.account_number` | ✅ Mapped |
| Transaction | `wallet_transactions.id` | `wallet_transactions.external_reference` | ✅ Mapped |
| Withdrawal | `withdrawal_requests.id` | `withdrawal_requests.safe_haven_reference` | ✅ Mapped |
| Identity | `safe_haven_identity_verifications.id` | `safe_haven_identity_verifications.identity_id` | ✅ Mapped |

### KYC States (PRD Section 6)
Current states: `not_started`, `initiate_pending`, `otp_sent`, `validate_pending`, `verified`, `rejected`, `expired`

PRD requires: `NOT_STARTED`, `PENDING`, `OTP_REQUIRED`, `PROCESSING`, `VERIFIED`, `FAILED`, `REQUIRES_REVIEW`, `EXPIRED`

**Gap:** Missing `REQUIRES_REVIEW` and `PROCESSING` states. Current `initiate_pending` and `validate_pending` partially cover these.

### Transaction States (PRD Section 12)
FTO states: `initiated`, `validated`, `posted`, `completed`, `failed`, `reversed`, `name_enquiry_completed`, `transfer_submitted`, `pending_settlement`, `requires_reconciliation`

PRD requires: `INITIATED`, `PENDING`, `PROCESSING`, `SUCCESSFUL`, `FAILED`, `REVERSED`, `CANCELLED`

**Gap:** Missing `CANCELLED` state. Current states are more granular than PRD (which is fine).

### Orphaned FK Issue
- Migration 00038: `notification_preferences` and `scheduled_reports` reference `profiles(id)` which was dropped in 00002
- Should reference `customers(id)` or `auth.users(id)`

---

## 5. Gap Summary — What Must Be Built

### Critical (Before Production Use)
1. Mask BVN/NIN in all API responses (`/api/me`, admin endpoints)
2. Remove client-side KYC bypass in onboarding page
3. Encrypt BVN/NIN at rest (pgcrypto or application-level)
4. Sanitize Safe Haven errors in client.ts
5. Scrub BVN/NIN from `safe_haven_api_calls` logs
6. Handle `account.debit` and `virtualAccount.transfer` webhooks

### High Priority
7. Unify auth.ts and client.ts (single OAuth implementation)
8. Unify environment variable naming
9. Delete legacy `src/lib/safe-haven/index.ts` mock stub
10. Fix SUPABASE_ANON_KEY fallback in adapter.ts
11. Add maker-checker for loan approvals
12. Create beneficiaries table + Safe Haven integration

### Medium Priority
13. Implement `GET /accounts/{id}/statement` for reconciliation
14. Add `GET /transfers/banks` for bank list in UI
15. Implement `GET /transfers` for transfer history
16. Add `CANCELLED` transaction state
17. Fix orphaned FK references (migration 00038)
18. Add real-time balance refresh option
19. Implement VAS (bill payments) if business requires

### Low Priority
20. Corporate sub-account creation
21. Account settings update API
22. vNIN, BVNUSSD, vID identity types
23. Beneficiary management (save/delete)
24. Rate limiting on all remaining API routes

---

## 6. What Already Works Well (Do Not Break)

✅ Safe Haven OAuth2 authentication (auth.ts is production-grade)
✅ Account creation via Safe Haven sub-account API
✅ BVN/NIN verification via 2-step OTP flow
✅ Transfer execution with name enquiry
✅ Transfer status query
✅ Idempotency (DB-backed, covers all money-moving operations)
✅ Webhook handling for incoming credits (with deduplication)
✅ Double-entry ledger (immutable, zero-sum enforced)
✅ Balance cache architecture (webhook → orchestrator → ledger → cache)
✅ PIN authentication (device-bound, PBKDF2, lockout)
✅ Rate limiting on sensitive endpoints
✅ RLS on all 73 tables
✅ Audit logging (3 log types)
✅ 8 cron jobs (reconciliation, interest, overdue, etc.)
✅ No Safe Haven credentials exposed to browser
✅ No direct Safe Haven calls from frontend
✅ Health check endpoint (used for monitoring)

---

*This audit was conducted as a read-only inspection. No code was modified.*
