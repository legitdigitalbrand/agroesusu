# AgroEsusu — Phase 1.5 PRD
## Trust, Virality & Identity Layer

**Document Owner:** Chinedu Okonkwo
**Date:** July 5, 2026
**Status:** Approved for Build
**Target:** Production deployment on agroesusu.vercel.app

---

## Overview

AgroEsusu v1 is live with personal savings pots, Paystack checkout deposits, and group savings scaffolding. Phase 1.5 addresses the four highest-leverage gaps between "working MVP" and "product people trust enough to put real money in":

1. **Deposit Verification Reliability** — webhook registration + server-side idempotent crediting
2. **Dedicated Virtual Accounts** — Paystack DVA API for bank-transfer deposits without checkout redirects
3. **Group Invite Links + WhatsApp Share** — the viral loop that unlocks the agro-association pilot
4. **BVN Verification** — lightweight KYC that anchors identity before first withdrawal

---

## Feature 1: Deposit Verification Reliability

### Problem
Deposits get stuck on "pending" because:
- The Paystack webhook URL is not registered in the Paystack dashboard
- The webhook and redirect-verify routes were using a session-based Supabase client (RLS blocked writes from server-to-server calls) — **already fixed in code**
- No retry or polling mechanism if the webhook is delayed

### Solution

#### 1.1 Webhook Registration (Manual — User Action Required)
- Register `https://agroesusu.vercel.app/api/paystack/webhook` in Paystack Dashboard → Settings → API Keys & Webhooks
- Events to subscribe: `charge.success`, `transfer.failed` (for future withdrawal failures)

#### 1.2 Server-Side Crediting (Already Built)
- `src/lib/deposit-credit.ts` — shared idempotent function using admin Supabase client
- Both `/api/paystack/webhook` and `/api/paystack/verify` call this function
- Idempotency guard: checks `transactions.status === 'completed'` before crediting
- Credits: savings_account.current_amount, profile.total_saved, creates in-app notification

#### 1.3 Client-Side Polling Fallback
- On `/deposit/success` page, if the first verify call returns "pending", poll every 3 seconds for up to 30 seconds
- If still pending after 30s, show "Payment received, processing" state (not "failed")
- This handles the case where Paystack payment succeeds but webhook is delayed by a few seconds

### Acceptance Criteria
- [ ] Webhook URL registered in Paystack dashboard
- [ ] After a successful Paystack test payment, transaction status changes to "completed" within 10 seconds
- [ ] Savings account balance updates correctly
- [ ] In-app notification appears
- [ ] Profile total_saved increments
- [ ] Duplicate webhook delivery does not double-credit (idempotency)
- [ ] If webhook fails, the redirect-verify path still credits the account

### Technical Notes
- The code fix is already deployed. The only remaining action is registering the webhook URL in the Paystack dashboard.
- Polling fallback on the success page is the remaining code change.

---

## Feature 2: Dedicated Virtual Accounts (DVA)

### Problem
Paystack checkout works but creates trust friction — users leave the app to a payment page they don't recognize. Nigerian users trust bank transfers to a dedicated account number in their name far more than card checkout redirects.

### Solution

#### 2.1 Paystack DVA Integration
- Use Paystack's **Dedicated Virtual Account** API
- Endpoint: `POST /dedicated_account` — creates a NUBAN account number for a customer
- Requires a Paystack customer to be created first (`POST /customer`)
- The account number is persistent — users can transfer into it at any time
- Paystack sends a `dedicated_account.assign.success` webhook when the account is created
- Paystack sends a `charge.success` webhook when a transfer is received (same as card payments — existing webhook handles this)

#### 2.2 User Flow
1. User completes registration (or on first deposit attempt)
2. System creates a Paystack customer (email, full_name, phone)
3. System creates a dedicated virtual account via Paystack API
4. Account number + bank name displayed on dashboard and deposit page
5. User transfers money from any Nigerian bank app → Paystack webhook fires → account credited (existing flow)
6. User sees deposit confirmed in transactions and notification

#### 2.3 Database Changes
- Add columns to `profiles` table:
  - `paystack_customer_code` (text, nullable) — Paystack customer code
  - `paystack_dva_account_number` (text, nullable) — NUBAN account number
  - `paystack_dva_bank_name` (text, nullable) — bank name (e.g., "Wema Bank")
  - `dva_status` (text, default 'pending') — pending / assigned / failed

#### 2.4 UI Components
- **DVA Card on Dashboard**: Prominent card showing account number (copyable), bank name, and "Transfer to this account to fund your savings"
- **DVA Section on Deposit Page**: Alternative to Paystack checkout — "Bank Transfer" tab alongside "Card/USSD" tab
- **Copy button**: One-tap copy of account number with haptic feedback
- **Educational tooltip**: "This is your personal AgroEsusu account. Any amount you transfer is automatically added to your default pot."

#### 2.5 API Routes
- `POST /api/paystack/dva/create` — creates Paystack customer + DVA for logged-in user
- `GET /api/paystack/dva/status` — returns user's DVA details
- Existing `/api/paystack/webhook` handles `dedicated_account.assign.success` and `charge.success` for DVA transfers

### Acceptance Criteria
- [ ] After registration, user can request a dedicated account number
- [ ] Account number is a valid NUBAN (10 digits) from a real Nigerian bank (Wema/Stanbic)
- [ ] Account number is displayed on dashboard with copy button
- [ ] When user transfers money to the DVA, Paystack webhook fires and account is credited
- [ ] DVA deposits are attributed to the user's default Flex pot (or a general wallet)
- [ ] User can see DVA deposits in transaction history
- [ ] Account number persists across sessions (stored in profile)

### Technical Notes
- Paystack DVA requires a business account (not test). The user has an existing Paystack business account.
- DVA creation costs nothing — Paystack charges per successful transaction (standard 1.5%).
- For test mode, Paystack provides test virtual accounts. We'll handle both modes.
- The DVA is tied to a Paystack customer, not a specific pot. All DVA deposits go to the user's default Flex pot, and they can redistribute from there.

---

## Feature 3: Group Invite Links + WhatsApp Share

### Problem
Groups exist but there's no way to invite people outside the app. The agro-association pilot requires sharing a link in a WhatsApp group that lets people join directly.

### Solution

#### 3.1 Invite Link System
- Each group gets a shareable URL: `agroesusu.vercel.app/groups/[id]?invite=token`
- Token is a short random string stored in the `savings_groups` table (new column: `invite_token`)
- Token is generated on group creation and can be regenerated by admin
- Visiting the invite link:
  - If logged in → shows group details + "Join Group" button
  - If not logged in → redirect to register with `?redirect=/groups/[id]?invite=token` so they land on the join page after auth

#### 3.2 WhatsApp Share Button
- On group detail page, admin sees a "Share to WhatsApp" button
- Opens `https://wa.me/?text=...` with pre-filled message:
  - "I've created an AgroEsusu savings group: [Group Name]. We contribute ₦[amount] [frequency]. Join here: [invite link]"
- Also a generic "Copy Link" button for sharing to any channel

#### 3.3 Database Changes
- Add column to `savings_groups` table:
  - `invite_token` (text, unique) — short random token for shareable links

#### 3.4 UI Components
- **ShareButton** component (client-side): WhatsApp share + copy link buttons
- On `/groups/[id]` page: show share buttons for admin, show "Join via invite" for non-members arriving with `?invite=token`
- On `/groups` list: admin sees a "Share" icon on their groups

#### 3.5 Invite Flow Detail
1. Admin taps "Share to WhatsApp" → WhatsApp opens with pre-filled message + invite link
2. Recipient taps link → browser opens to `agroesusu.vercel.app/groups/[id]?invite=token`
3. If not logged in → register page with redirect back to group
4. After auth → group detail page with "Join Group" button highlighted
5. User taps "Join" → added as member with next slot position
6. Admin sees new member in group members list
7. When group is full → status changes to "active"

### Acceptance Criteria
- [ ] Every group has an invite token generated on creation
- [ ] Share to WhatsApp button opens WhatsApp with pre-filled message and group link
- [ ] Copy link button copies invite URL to clipboard
- [ ] Opening invite link while logged out redirects to register, then back to group after auth
- [ ] Opening invite link while logged in shows group with highlighted "Join" button
- [ ] Joining via invite link adds user as member with correct slot position
- [ ] Admin can regenerate invite token (invalidates old link)
- [ ] Group shows member count updating as people join

### Technical Notes
- Invite tokens are NOT security tokens — they're for convenience. Group visibility is already public (anyone can see and join recruiting groups). The token just provides a direct link.
- Token format: 8-character alphanumeric (e.g., `aB3xK9mQ`)
- No expiry on tokens for MVP — admin can regenerate if needed.

---

## Feature 4: BVN Verification (Lightweight KYC)

### Problem
No identity verification exists. Before enabling withdrawals, the platform needs a real identity anchor to prevent fraud and build trust. Full KYC (ID upload, address verification) is overkill for a savings-only MVP.

### Solution

#### 4.1 Paystack BVN Verification
- Paystack provides a BVN verification endpoint: `GET /bank/resolve_bvn/:bvn`
- Returns: first name, last name, phone number, date of birth tied to the BVN
- Cost: ~₦100 per verification (Paystack charges)
- This gives us a real identity anchor without document uploads

#### 4.2 User Flow
1. After registration, user sees a "Verify your identity" prompt on dashboard and profile
2. User enters their 11-digit BVN
3. System calls Paystack BVN verification API
4. If the name on BVN matches the registered name (fuzzy match) → `kyc_status` = 'verified'
5. If names don't match → `kyc_status` = 'pending_review' (admin manually reviews)
6. If BVN is invalid → error message, user can retry

#### 4.3 Tiered Access
- **Unverified (no BVN)**: Can save up to ₦50,000 total. Cannot withdraw. Sees "Verify your identity to unlock withdrawals" banner.
- **Verified (BVN matched)**: Can save unlimited. Can withdraw. Full platform access.
- **Pending review (BVN name mismatch)**: Can save up to ₦50,000. Cannot withdraw. Admin reviews and can manually approve.

#### 4.4 Database Changes
- Add columns to `profiles` table:
  - `bvn` (text, nullable) — encrypted/stored as hash
  - `bvn_first_name` (text, nullable) — from Paystack verification
  - `bvn_last_name` (text, nullable) — from Paystack verification
  - `bvn_phone` (text, nullable) — from Paystack verification
  - `kyc_status` (text, default 'unverified') — unverified / verified / pending_review
  - `kyc_verified_date` (timestamptz, nullable)

#### 4.5 UI Components
- **KYC Banner**: Shows on dashboard if `kyc_status !== 'verified'` — "Verify your identity to unlock withdrawals"
- **Verify Identity Page** (`/profile/verify`): BVN input form, verification status display
- **Profile Page**: Shows KYC status badge (Unverified / Verified / Pending Review)
- **Withdrawal Gate**: If `kyc_status !== 'verified'`, withdrawal page shows "Verify your identity first" with link to `/profile/verify`

#### 4.6 API Routes
- `POST /api/kyc/verify-bvn` — calls Paystack BVN verification, updates profile
- Uses admin Supabase client (bypasses RLS for the profile update)

#### 4.7 Security Considerations
- BVN is sensitive PII — store only the last 4 digits + a hash in the database
- Never display full BVN in the UI
- BVN verification response from Paystack is logged but PII fields (phone, DOB) are not persisted
- Only `kyc_status`, `bvn_last_4`, and name match result are stored

### Acceptance Criteria
- [ ] User can enter BVN on a verify identity page
- [ ] BVN is verified via Paystack API
- [ ] If name matches → kyc_status = 'verified', withdrawal unlocked
- [ ] If name doesn't match → kyc_status = 'pending_review', user notified
- [ ] Unverified users see a banner on dashboard
- [ ] Unverified users cannot withdraw (blocked on withdraw page with redirect to verify)
- [ ] BVN is not displayed in full anywhere in the UI
- [ ] Profile page shows KYC status badge
- [ ] Only the last 4 digits of BVN are stored

### Technical Notes
- Paystack BVN resolution requires a business account (the user has one).
- Test mode: Paystack provides a test BVN (`00000000000`) that returns a fixed response.
- Name matching: compare registered `full_name` with BVN `first_name + last_name` using a normalized string comparison (lowercase, strip whitespace, check if first name appears in full name or vice versa).
- BVN storage: store `SHA-256 hash` of BVN + last 4 digits. Never store raw BVN.

---

## Implementation Order

1. **Feature 1** — Deposit polling fallback (webhook registration is manual, code is already fixed)
2. **Feature 4** — BVN verification (database schema + API + UI)
3. **Feature 2** — Dedicated Virtual Accounts (Paystack DVA API + UI)
4. **Feature 3** — Group invite links + WhatsApp share (viral loop)

Features 1 and 4 are independent and can be built in parallel. Feature 2 depends on the Paystack customer flow. Feature 3 is standalone.

---

## Database Migration Summary

All new columns are additive (nullable with defaults) — no data loss risk.

```sql
-- Feature 2: DVA columns
ALTER TABLE profiles ADD COLUMN paystack_customer_code TEXT;
ALTER TABLE profiles ADD COLUMN paystack_dva_account_number TEXT;
ALTER TABLE profiles ADD COLUMN paystack_dva_bank_name TEXT;
ALTER TABLE profiles ADD COLUMN dva_status TEXT DEFAULT 'pending';

-- Feature 3: Group invite token
ALTER TABLE savings_groups ADD COLUMN invite_token TEXT UNIQUE;

-- Feature 4: KYC columns
ALTER TABLE profiles ADD COLUMN bvn_last_4 TEXT;
ALTER TABLE profiles ADD COLUMN bvn_hash TEXT;
ALTER TABLE profiles ADD COLUMN bvn_first_name TEXT;
ALTER TABLE profiles ADD COLUMN bvn_last_name TEXT;
ALTER TABLE profiles ADD COLUMN kyc_status TEXT DEFAULT 'unverified';
ALTER TABLE profiles ADD COLUMN kyc_verified_date TIMESTAMPTZ;
```

---

## Environment Variables

All already set on Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

No new environment variables needed.

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Paystack DVA not available in test mode | Feature 2 blocked in dev | Use test virtual accounts; build with feature flag |
| BVN verification cost (₦100/check) | User onboarding cost | Only verify once; cache result; don't re-verify |
| Webhook delivery delays | Deposit appears pending | Polling fallback on success page (Feature 1.3) |
| BVN name mismatch false positives | Users locked out | Admin review path + fuzzy name matching |
| Invite token guessing | Unauthorized group access | Not a real risk — groups are public for MVP |
