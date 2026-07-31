# Phase 14 — External Bank Withdrawal & Communications Module

**Date:** July 31, 2026
**Status:** ✅ Complete — Deployed to Production
**Commits:** 4 (6cb1e4f → 9d21632)
**Production URL:** https://agriqcap.vercel.app

---

## Summary

Phase 14 delivers two major capabilities:

1. **External Bank Withdrawal Flow** — Two-phase withdrawal lifecycle with Safe Haven integration, tier-based limits, idempotent processing, webhook reconciliation, and a 9-step user interface.
2. **Communications Domain** — Notification dispatcher with retry logic, 25+ templates across 5 categories, repository CRUD, and 4 API routes powering the notifications UI.

Plus: Cron auth hardening, database migration fixes, and production smoke testing.

---

## 1. External Bank Withdrawal

### Architecture

Two-phase commit pattern for external transfers:

```
Phase 1: RESERVE
  User requests withdrawal → validate limits → reserve balance → create withdrawal_request → submit transfer to Safe Haven → mark "transfer_submitted"

Phase 2: SETTLE/REVERSE
  Safe Haven webhook OR reconciliation cron → check transfer status →
    Success: settle (debit wallet, record settlement FT, mark "completed")
    Failure: reverse (release reserved balance, mark "failed")
```

### Files Created

| File | Purpose |
|------|---------|
| `src/modules/withdrawal/types.ts` | WithdrawalRequest, WithdrawalLimits, ReconciliationResult types |
| `src/modules/withdrawal/limits.ts` | Tier-based limit calculation (daily/monthly/single-transaction) |
| `src/modules/withdrawal/service.ts` | Core service: createWithdrawal, checkNameEnquiry, reconcileWithdrawal |
| `src/modules/withdrawal/index.ts` | Module public API |

### API Routes (8 new)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/wallets/withdraw` | POST | ✅ JWT | Initiate withdrawal (reserve + submit) |
| `/api/wallets/withdraw/name-enquiry` | POST | ✅ JWT | Bank account name verification |
| `/api/wallets/withdraw/[withdrawalId]` | GET | ✅ JWT + ownership | Get withdrawal status |
| `/api/wallets/withdraw/[withdrawalId]/reconcile` | POST | ✅ JWT + ownership | Manually trigger reconciliation |
| `/api/cron/reconcile-withdrawals` | GET | ✅ CRON_SECRET | Daily reconciliation sweep |
| `/api/webhooks/safe-haven` | POST | HMAC signature | Webhook → reconciliation trigger |

### UI

`src/app/(app)/wallet/withdraw/page.tsx` — 9-step flow:
1. Select beneficiary bank (searchable dropdown)
2. Enter account number
3. Name enquiry verification
4. Enter amount
5. Review summary
6. Processing (with spinner)
7. Result screen (success/failure)
8. Error handling with retry
9. Reserved balance display

### Limits (Tier-Based)

| Tier | Daily Limit | Single Transaction | Monthly Limit |
|------|-------------|---------------------|---------------|
| Tier 1 (Basic KYC) | ₦50,000 | ₦50,000 | ₦200,000 |
| Tier 2 (Full KYC) | ₦500,000 | ₦500,000 | ₦2,000,000 |
| Tier 3 (Premium) | ₦5,000,000 | ₦2,000,000 | ₦20,000,000 |

Limits enforced server-side. Reserved balance tracked separately from available balance.

### Orchestrator Integration

New posting templates added:
- `wallet_withdrawal_reservation`: D Wallet, C Safe Haven Suspense (1001)
- `wallet_withdrawal_settlement`: D Safe Haven Suspense, C Safe Haven Settlement (1000)

### Webhook Reconciliation

The Safe Haven webhook handler (`/api/webhooks/safe-haven`) now processes:
- `transfer.completed` → settle withdrawal
- `transfer.failed` → reverse withdrawal
- Payment reference extraction → withdrawal_request lookup
- Idempotent event storage (no double-processing)

### Reconciliation Cron

Daily at noon UTC (Vercel Hobby plan constraint — should be every 15 min on Pro):
- Queries pending withdrawals older than 5 minutes
- Calls Safe Haven API to check transfer status
- Settles or reverses accordingly
- Protected by CRON_SECRET

---

## 2. Communications Domain

### Architecture

Non-blocking notification dispatcher — never fails financial transactions even if notification delivery fails.

### Files Created

| File | Purpose |
|------|---------|
| `src/modules/communications/types.ts` | NotificationType, NotificationCategory, DispatchResult types |
| `src/modules/communications/templates.ts` | 25+ notification templates (title + message builders) |
| `src/modules/communications/repository.ts` | Supabase CRUD for notifications table |
| `src/modules/communications/dispatcher.ts` | Dispatcher with 3x retry, non-blocking error handling |
| `src/modules/communications/index.ts` | Module public API |

### Notification Templates (28 types across 7 categories)

**Auth (3):** account_created, password_reset, security_event
**Financial (6):** deposit_received, withdrawal_initiated, withdrawal_completed, withdrawal_failed, transfer_pending, transfer_completed
**Savings (4):** savings_created, contribution_received, savings_withdrawal, savings_maturity
**Loans (7):** loan_application_submitted, loan_approved, loan_rejected, loan_disbursed, loan_repayment_due, loan_repayment_received, loan_overdue
**Investments (4):** investment_subscribed, investment_matured, investment_returns, investment_redeemed
**Verification (3):** verification_pending, verification_approved, verification_rejected
**General (1):** general

### API Routes (4 new)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/notifications` | GET | ✅ JWT | List user's notifications (paginated) |
| `/api/notifications/unread-count` | GET | ✅ JWT | Get unread count (for badge) |
| `/api/notifications/[id]/read` | PATCH | ✅ JWT + ownership | Mark single notification as read |
| `/api/notifications/read-all` | PATCH | ✅ JWT | Mark all as read |

### Integration Points

- **Deposit route** (`/api/wallets/[walletId]/deposit`): dispatches `deposit_received` notification after successful deposit
- **Withdrawal service**: dispatches `withdrawal_initiated`, `withdrawal_completed`, `withdrawal_failed` notifications
- **Orchestrator**: posting templates include notification dispatch hooks

### Notifications UI

`src/app/(app)/notifications/page.tsx` — updated from static/mock to real API data:
- Fetches from `/api/notifications` with pagination
- Unread count badge
- Mark as read / mark all as read
- Category-based visual styling
- Empty state handling

---

## 3. Database Migrations

### Migration 00038: Withdrawal Infrastructure

- Extended `ft_status` enum: name_enquiry_completed, transfer_submitted, pending_settlement, requires_reconciliation
- Extended `ft_type` enum: wallet_withdrawal_reservation, wallet_withdrawal_settlement
- Extended `notification_type` enum: 10 new values (deposit_received, withdrawal_*, transfer_*)
- New table: `withdrawal_requests` (id, customer_id, wallet_id, amount, fee, bank_code, bank_name, account_number, account_name, payment_reference, status, safe_haven_reference, failure_reason, ip_address, device_id, metadata, timestamps)
- New table: `notification_preferences` (user_id, channel prefs, quiet hours)
- New table: `scheduled_reports` (report_key, schedule_type, parameters, next_run_at, last_run_at, is_active)

### Migration 00039: Recreate Notifications Table

**Problem discovered:** The `notifications` table and `notification_type` enum were dropped in migration 00002 (prototype cleanup) and never recreated. Migration 00038 tried to ALTER the enum but it didn't exist.

**Fix:**
- Created `notification_type` enum with 28 values
- Created `notification_category` enum (7 values)
- Created `notification_status` enum (6 values)
- Created `notifications` table with FK to `auth.users(id)` (not `profiles` which was also dropped)
- Phase 14 extensions: category, delivery_status, related_entity_type, related_entity_id, read_at
- RLS: users see only their own notifications, service role can insert/delete
- Indexes: (user_id, created_at DESC), (user_id, read) WHERE read=false

**Current table count: 61 tables**

---

## 4. Security Hardening

### Cron Authentication

All new cron endpoints now validate `CRON_SECRET` via `Authorization: Bearer` header:
- `/api/cron/reconcile-withdrawals` — was open, now protected
- `/api/cron/run-scheduled-reports` — was open, now protected

Pattern: `if (cronSecret && authHeader !== Bearer ${cronSecret}) → 401`
(Graceful: if CRON_SECRET is not set, endpoint is open — this allows local dev)

### API Authorization

All new API routes enforce:
- JWT authentication (Supabase session)
- Ownership verification (user can only access their own withdrawals/notifications)
- Server-side limit enforcement (limits never computed client-side)

---

## 5. Production Verification

### Smoke Test Results (July 31, 2026)

| Check | Endpoint | Expected | Result |
|-------|----------|----------|--------|
| Homepage | `/` | 200 | ✅ 200 |
| Login page | `/login` | 200 | ✅ 200 |
| Dashboard auth guard | `/dashboard` | 307 | ✅ 307 |
| Withdraw page auth guard | `/wallet/withdraw` | 307 | ✅ 307 |
| Notifications page auth guard | `/notifications` | 307 | ✅ 307 |
| Notifications API (no auth) | `/api/notifications` | 401 | ✅ 401 |
| Withdrawal API (no auth) | `/api/wallets/withdraw` | 401 | ✅ 401 |
| Deposit API (no auth) | `/api/wallets/:id/deposit` | 401 | ✅ 401 |
| Safe Haven webhook | `/api/webhooks/safe-haven` | 200 | ✅ 200 |

### Database Verification

- 61 tables present
- `withdrawal_requests` ✅
- `notifications` ✅
- `notification_preferences` ✅
- `scheduled_reports` ✅
- All 3 new enums (notification_type: 28 values, notification_category: 7, notification_status: 6)

### Build & Tests

- TypeScript: 0 errors
- Next.js build: ✅ pass
- Jest tests: 12/12 pass
- Production deployment: ✅ live

---

## 6. Vercel Cron Schedule (Hobby Plan)

All crons adjusted to daily-only (Vercel Hobby plan limitation):

| Cron | Schedule | Purpose |
|------|----------|---------|
| process-events | 0 3 * * * | Wallet event processing |
| reconcile | 0 2 * * * | Wallet reconciliation |
| accrue-interest | 0 1 * * * | Savings interest accrual |
| check-overdue | 0 6 * * * | Loan overdue detection |
| process-esusu-payouts | 0 8 * * * | Esusu rotation payouts |
| process-returns | 0 9 * * * | Investment returns |
| **reconcile-withdrawals** | **0 12 * * *** | **Withdrawal reconciliation (NEW)** |
| **run-scheduled-reports** | **0 6 * * *** | **Scheduled report generation (NEW)** |

**Note:** On Vercel Pro plan, reconcile-withdrawals should run every 15 minutes for timely settlement.

---

## 7. Code Stats

- **New files:** 23
- **Modified files:** 8
- **New lines of code:** ~2,323 (new files only)
- **New API routes:** 12 (8 withdrawal + 4 notifications)
- **New database tables:** 4 (61 total)
- **New migrations:** 2 (00038, 00039)
- **New cron jobs:** 2 (9 total)
- **New orchestrator templates:** 2 (wallet_withdrawal_reservation, wallet_withdrawal_settlement)
- **Notification templates:** 28

---

## 8. What's Next (Phase 15 Candidates)

1. **Credit Score & Loan Eligibility API** — Endpoints for credit score retrieval and real-time loan eligibility checks
2. **Wallet Funding/Deposit API** — External bank deposit via Safe Haven (currently only internal transfers)
3. **Email/SMS Delivery** — Connect notification dispatcher to actual email/SMS providers
4. **Push Notifications** — Web push or mobile push for real-time alerts
5. **Admin Staff Management API** — CRUD endpoints for staff users (tables exist, no API)
6. **Reconciliation Resolution API** — Allow admins to resolve reconciliation flags via API
7. **Rate Limiting** — Add rate limits to API routes (especially financial endpoints)
8. **Integration Tests** — End-to-end test coverage for financial flows
9. **AML/Sanctions Screening** — Active monitoring (KYC levels tracked but no active screening)
10. **Vercel Pro Upgrade** — Unlock 15-minute withdrawal reconciliation cron
