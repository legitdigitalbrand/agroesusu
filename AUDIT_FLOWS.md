# Agriqcap / Agroesusu Flow Audit Report

**Date:** July 31, 2026  
**Audited Components:** Wallet Funding, Savings Account Creation, Loan Eligibility

---

## Executive Summary

An audit was conducted on the wallet funding, savings account opening, and loan eligibility flows across both backend API routes and frontend UI pages in the Agriqcap repository (`/app/agroesusu-repo`). 

Key takeaways:
1. **Wallet Funding Flow:** Fully implemented end-to-end on both API and UI levels. Integrates Safe Haven Dedicated Virtual Accounts (DVAs), auto-provisions requests, handles error/KYC states, polls for updates, and includes sandbox simulation for testing.
2. **Savings Account Creation Flow:** The backend API (`POST /api/savings/accounts`) and underlying savings module (`@/modules/savings`) are fully built with rate-limiting, staff overrides, product term snapshotting, and automatic initial deposit handling. However, **the frontend UI (`/savings/page.tsx`) is disconnected**: clicking "Open account" on a product card is currently a dummy link (`<Link href="/savings">`) that simply reloads the page.
3. **Loan Eligibility Flow:** The backend eligibility engine (`/api/loans/eligibility`) is rich and sophisticated, evaluating 8 distinct risk and savings signals. However, **the frontend UI (`/loans/page.tsx`) never calls this API**. Instead, it hardcodes eligibility to the product's static `max_amount` field and provides a dummy "Continue application" button (`<Link href="/loans">`).

---

## 1. Wallet Funding Flow

### 1.1 Backend API: `src/app/api/wallets/funding-details/route.ts`
* **Purpose:** Serves customer's Dedicated Virtual Account (DVA) details for bank transfer funding.
* **Database Queries & Tables:**
  1. `customers`: Queries `.select('id, status, kyc_level').eq('auth_id', user.id).maybeSingle()` using the user-scoped Supabase client.
  2. `safe_haven_accounts`: Queries `.select('account_number, account_name, bank_name, bank_code, status').eq('customer_id', customer.id).maybeSingle()` using the service role client.
  3. `wallets`: Queries `.select('id, status').eq('customer_id', customer.id).eq('status', 'active').limit(1).maybeSingle()` using the service role client.
  4. `incoming_deposit_requests`: Inserts a tracking record (`customer_id`, `wallet_id`, `safe_haven_account_number`, `status: 'pending'`, `ip_address`, `user_agent`).
* **User Mapping:** Maps `supabase.auth.getUser()` → `customers.auth_id` → `customers.id` → `safe_haven_accounts.customer_id` & `wallets.customer_id`.
* **Error Handling & Response Shapes:**
  * `401 Unauthorized`: Returns `{ error: 'Unauthorized' }` if missing/invalid session.
  * `404 Not Found`: Returns `{ error: 'Customer profile not found' }` if customer profile is missing.
  * `200 OK (Unprovisioned)`: If no Safe Haven account exists, returns `{ provisioned: false, message: 'No Safe Haven account provisioned. Complete identity verification first.' }`.
  * `200 OK (Inactive DVA)`: If Safe Haven account status is not `'active'`, returns `{ provisioned: true, account: safeHavenAccount, message: 'Account is [status]. Please contact support.' }`.
  * `400 Bad Request`: Returns `{ error: 'No active wallet found' }` if no active wallet exists.
  * `200 OK (Success)`: Returns:
    ```json
    {
      "provisioned": true,
      "account": {
        "account_name": "...",
        "account_number": "...",
        "bank_name": "...",
        "bank_code": "..."
      },
      "wallet_id": "...",
      "instructions": "Transfer money to the account above. Your wallet will be credited automatically once the transfer is confirmed by Safe Haven."
    }
    ```

### 1.2 Frontend UI: `src/app/(app)/wallet/deposit/page.tsx`
* **API Invocations:**
  * Fetches `/api/wallets/funding-details` on mount via `loadFundingDetails()`.
  * Sets up a 30-second polling interval while `status === 'ready'` to automatically pick up completed credits.
  * In non-production environments (`NODE_ENV !== 'production'`), provides sandbox funding via POST to `/api/wallets/${details.wallet_id}/deposit`.
* **Data Displayed:**
  * Dedicated Virtual Account Card: Account Name, Account Number, and Bank Name.
  * Copy-to-clipboard functionality with active confirmation icons for each field.
  * Dynamic funding instructions from the backend payload.
  * Web Share API integration (or fallback clipboard copy) to share funding instructions.
* **Error & State Handling:**
  * **Loading:** Centered spinner with *"Loading funding details…"*.
  * **API Error (`status === 'error'`):** Card with *"Something went wrong"* message and *"Try again"* retry button.
  * **Not Provisioned (`status === 'not_provisioned'`):** Prompts user *"Verify your identity first"* with direct link to `/verification`.
  * **Sandbox Stages:** Handles `processing` spinner, `success` confirmation modal (`"Wallet funded!"`), and `failed` error state with retry.

---

## 2. Savings Account Opening Flow

### 2.1 Backend API & Module: `src/app/api/savings/accounts/route.ts` & `src/modules/savings`
* **Endpoint:** `POST /api/savings/accounts`
* **Account Creation Logic:**
  1. Applies endpoint rate limiting (`RATE_LIMITS.SAVINGS`).
  2. Verifies user session (`supabase.auth.getUser()`).
  3. Checks staff privilege via `supabase.rpc('is_staff')`:
     * If Staff: Expects `customer_id` in request body and resolves customer wallet via service client.
     * If Customer: Resolves `customer_id` via `auth_id`, then fetches active wallet.
  4. Calls `openAccount()` in `@/modules/savings/accounts.ts`:
     * Validates savings product existence and `is_active` flag via `getProduct(product_id)`.
     * Captures a immutable snapshot of product terms (`interest_rate`, `interest_cadence`, `lock_period_days`, `term_days`, etc.).
     * Calculates `maturity_date` if `term_days > 0`.
     * Inserts `savings_accounts` record with `status: 'pending'`.
     * Activates account (`status: 'active'`) if `initial_deposit > 0`.
  5. Back in route handler, if `initial_deposit > 0`, invokes `deposit()` to transfer funds from wallet to savings account.
* **Validation:**
  * Checks for missing `product_id` (400).
  * Validates `customer_id` requirement for staff requests (400).
  * Validates customer profile exists (404).
  * Validates active wallet exists (400).
* **Response Shapes:**
  * Success (201 Created): `{ account: SavingsAccount }`.
  * Success with Deposit Failure Warning (201 Created): `{ account: SavingsAccount, warning: 'Account opened but initial deposit failed...' }`.
  * Error (400 / 401 / 404 / 500): `{ error: string }`.

### 2.2 Frontend UI: `src/app/(app)/savings/page.tsx`
* **Current Implementation:**
  * Renders a tabbed interface ("My Accounts" and "Browse Products").
  * Fetches accounts via `GET /api/savings/accounts` and products via `GET /api/savings/products`.
* **'Open Account' Button Audit:**
  * On each product card, "Open account" is rendered as:
    ```tsx
    <Link href="/savings" className="inline-block mt-3 text-xs px-3.5 py-1.5 rounded-lg bg-indigo text-white">
      Open account
    </Link>
    ```
  * In the empty state, "Open your first account" simply switches tabs: `onClick={() => setActiveTab("products")}`.
* **Flow & Disconnect Assessment:**
  * **CRITICAL GAP:** Clicking "Open account" does **NOT** open a modal, form, or creation workflow, nor does it issue a `POST /api/savings/accounts` request. It simply reloads/links back to `/savings`.
  * There is no UI component in place for capturing target amounts or initial deposit inputs.

---

## 3. Loan Eligibility Flow

### 3.1 Backend API & Module: `src/app/api/loans/eligibility/route.ts` & `src/modules/loans/eligibility.ts`
* **Endpoint:** `GET /api/loans/eligibility?product_id=xxx`
* **Flow:**
  1. Validates auth user and `product_id` query parameter.
  2. Resolves customer profile and active wallet.
  3. Fetches loan product metadata via `getProduct(productId)`.
  4. Calls `evaluateEligibility()` passing the product's `max_amount` and `default_term_months`.
* **Eligibility Evaluation Rules (`evaluateEligibility`):**
  * Evaluates 8 distinct factors against stored historical data:
    1. **Savings Multiplier:** `savingsBalance * product.savings_multiplier >= requested_amount`
    2. **Savings Tenure:** `savingsTenureDays >= min_savings_tenure_days`
    3. **Consistency Score:** `consistencyScore >= min_consistency_score`
    4. **Stability Score:** `stabilityScore >= min_stability_score`
    5. **Internal Credit Score:** Computed (range 300–850) based on tenure, consistency, stability, minus penalties for defaults and late repayments. Must exceed `min_credit_score`.
    6. **Risk Level:** Verifies customer is not restricted due to defaults.
    7. **Cooperative Membership:** Verifies membership status if required by product.
    8. **Min/Max Limits:** Verifies amount bounds.
* **Return Shape:**
  ```json
  {
    "decision": "approved | denied | conditional",
    "approved_amount": 350000,
    "factors": [ /* factor objects with value, threshold, passed, weight */ ],
    "credit_score": 680,
    "savings_balance": 150000,
    "max_eligible_amount": 450000,
    "cooperative_status": "verified | not_member | not_available",
    "rationale": "Detailed decision breakdown"
  }
  ```

### 3.2 Frontend UI: `src/app/(app)/loans/page.tsx`
* **Current Implementation:**
  * Tabbed layout ("My Loans" and "Eligibility").
  * Under "Eligibility" tab, fetches loan products list from `GET /api/loans/products`.
* **'Check Eligibility' Button Audit:**
  * In empty state, "Check your eligibility" switches the active tab to `"products"` (`onClick={() => setActiveTab("products")}`).
  * In the product card (`ProductEligibility`), max borrowable amount is rendered directly from `product.max_amount`:
    ```tsx
    <p className="font-mono text-[26px] font-medium mb-3">{fmtNGN(maxBorrow)}</p>
    ```
* **Flow & Disconnect Assessment:**
  * **CRITICAL GAP:** The frontend **never calls `/api/loans/eligibility`**.
  * The max borrow amount shown to the user is static product metadata, not the personalized server-computed limit based on their actual savings signals and credit score.
  * The CTA button "Continue application" is a static link (`<Link href="/loans">`), with no application submission or backend eligibility verification wired up.

---

## Summary Matrix & Action Items

| Feature / Flow | Backend API Status | Frontend UI Status | Wire-up Status | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **Wallet Funding** | Fully Functional (`GET /api/wallets/funding-details`) | Fully Functional (`/wallet/deposit`) | **Connected** | None. Operational. |
| **Savings Account Creation** | Fully Functional (`POST /api/savings/accounts`) | Incomplete (`/savings`) | **Disconnected** | Build account creation modal/form in `/savings/page.tsx` to invoke `POST /api/savings/accounts`. |
| **Loan Eligibility Evaluation** | Fully Functional (`GET /api/loans/eligibility`) | Mocked/Static (`/loans`) | **Disconnected** | Update `/loans/page.tsx` to query `/api/loans/eligibility?product_id=xxx` and display real evaluation results. |

