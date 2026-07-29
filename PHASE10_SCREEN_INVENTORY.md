# Phase 10 — Screen Inventory & Flow Map
## Agriqcap Customer & Admin Frontend

**Status:** AWAITING CTO APPROVAL — no UI code has been written.  
**Date:** 2026-07-28

---

## Web vs. Native Recommendation

**Recommendation: Responsive Web App (PWA) for v1.**

Rationale:
- The backend is fully API-driven — works with any frontend
- PWA gives installability + offline caching without a separate codebase
- Target users (farmers, SMEs, individuals across Nigeria) have varying device capabilities — web is the most accessible
- Building native (React Native) doubles the frontend effort for v1 with no clear user research mandate
- Next.js already supports PWA patterns (service worker, manifest, install prompt)
- Native mobile should be a v2 decision based on user research — specifically whether farmers need camera-based document capture, SMS push notifications, or true offline-first with local data

**Confirmation needed from CTO:** Is web-only (PWA) acceptable for v1, or is there a stakeholder requirement for native mobile?

---

## Current State

### Already Built
- **Marketing site:** Home, About, Features, Savings Plans, Loan Plans, Careers, Contact, Blog, FAQs (route group `(marketing)`)
- **Auth:** Signup, Login, Onboarding (4-step KYC flow: BVN/NIN → Address → Farm/Business → Next of Kin) (route group `(auth)`)
- **App layout shell:** Empty layout at `src/app/(app)/layout.tsx` — no pages yet
- **API:** 44 routes across all modules (Phases 1-9)

### Not Built
- No customer app screens (dashboard, savings, loans, cooperative, investments, notifications, profile)
- No admin console screens
- No design system / component library (marketing pages use Tailwind + ad hoc components)

---

## API Contract Summary (What the Frontend Consumes)

### Customer-Facing APIs

| Module | Endpoint | Method | Purpose |
|---|---|---|---|
| **Wallet** | `/api/wallets/[walletId]/balance` | GET | Wallet balance (4D: available, ledger, reserved, pending) |
| | `/api/wallets/[walletId]/transactions` | GET | Transaction history |
| **Savings** | `/api/savings/products` | GET | Browse savings products |
| | `/api/savings/accounts` | GET, POST | List accounts / Open new account |
| | `/api/savings/accounts/[id]` | GET | Account details + transaction history |
| | `/api/savings/accounts/[id]/deposit` | POST | Deposit to savings |
| | `/api/savings/accounts/[id]/withdraw` | POST | Withdraw from savings |
| **Loans** | `/api/loans/products` | GET | Browse loan products |
| | `/api/loans` | GET, POST | List loans / Apply for loan |
| | `/api/loans/[id]` | GET | Loan details + repayment schedule |
| | `/api/loans/[id]/repay` | POST | Repay loan |
| **Cooperative** | `/api/cooperatives` | GET | List cooperatives |
| | `/api/cooperatives/[coopId]` | GET | Cooperative details + membership status |
| | `/api/cooperatives/[coopId]/join` | POST | Join cooperative |
| | `/api/cooperatives/[coopId]/elections` | GET | List elections |
| | `/api/cooperatives/[coopId]/elections/[electionId]/vote` | POST | Cast vote |
| | `/api/cooperatives/[coopId]/meetings` | GET | List meetings |
| | `/api/cooperatives/[coopId]/resolutions` | GET | List resolutions |
| **Group Savings** | `/api/group-savings/products` | GET | Browse group savings products |
| | `/api/group-savings/accounts` | GET | List group savings accounts |
| | `/api/group-savings/accounts/[id]` | GET | Group account details |
| | `/api/group-savings/accounts/[id]/join` | POST | Join group |
| | `/api/group-savings/accounts/[id]/contribute` | POST | Contribute to group |
| **Esusu** | `/api/esusu/[groupId]` | GET | Esusu group details + rotation schedule |
| **Investments** | `/api/investments/products` | GET | Browse investment products |
| | `/api/investments/accounts` | GET, POST | List portfolio / Subscribe |
| | `/api/investments/accounts/[id]` | GET | Investment account details |
| | `/api/investments/accounts/[id]/redeem` | POST | Redeem investment |
| | `/api/investments/accounts/[id]/rollover` | POST | Rollover to new term |

### Admin-Facing APIs

| Module | Endpoint | Method | Purpose |
|---|---|---|---|
| **Dashboard** | `/api/admin/dashboard` | GET | Operational dashboard + admin overview |
| **Audit** | `/api/admin/audit` | GET | Audit log viewer (filterable) |
| **Compliance** | `/api/admin/compliance` | GET | Compliance reports (deposits, loans, reconciliation, KYC) |
| **Risk** | `/api/admin/risk` | GET | Risk/portfolio views |
| **Reports** | `/api/admin/reports` | GET | List available reports by role |
| | `/api/admin/reports/[reportKey]` | GET | Generate/export report (CSV/JSON) |
| **Reconciliation** | `/api/admin/reconciliation-flags` | GET | List reconciliation flags |
| **Investments Admin** | `/api/investments/products/[id]/performance` | POST | Record pool performance |
| | `/api/investments/products/[id]/distribute` | POST | Distribute pool returns |
| **Loans Admin** | `/api/loans/[id]/disburse` | POST | Disburse loan |

---

## API Gaps Discovered During Screen Mapping

These are endpoints the frontend needs but the backend doesn't provide yet. Each is a flagged gap for CTO decision — not something to work around client-side.

| # | Gap | Screens Affected | Severity | Recommendation |
|---|---|---|---|---|
| G1 | **No `/api/me` endpoint** — customers need their own customer record (wallet ID, KYC status, name, membership status) to bootstrap every other screen | Dashboard, all customer screens | **BLOCKER** | Add `/api/me` GET endpoint returning customer record + wallet ID + active accounts summary |
| G2 | **No product config CRUD APIs** — admin can't create/edit savings, loan, investment, or group savings products via API (all product routes are GET-only) | Admin: Product Configuration | **BLOCKER for admin** | Add POST/PUT/DELETE to product routes, gated to admin roles |
| G3 | **No staff management API** — can't create staff users, assign roles, or manage access | Admin: RBAC/User Management | **BLOCKER for admin** | Add `/api/admin/staff` CRUD endpoints |
| G4 | **No admin loan review/override API** — loan officers can't review applications, approve/reject, or override eligibility decisions with reason logging | Admin: Loan Officer Review | **BLOCKER for loan officers** | Add `/api/admin/loans/[id]/review` POST with reason field + audit logging |
| G5 | **No admin customer search/lookup API** — support staff can't search for or view customer profiles | Admin: Customer Support Tools | **High** | Add `/api/admin/customers` GET with search + `/api/admin/customers/[id]` GET |
| G6 | **No reconciliation resolution API** — flags can be viewed but not resolved | Admin: Reconciliation Management | **High** | Add `/api/admin/reconciliation-flags/[id]/resolve` POST |
| G7 | **No notifications API** — communications module is a stub | Customer: Notifications/Inbox | **Medium** | Defer notifications screen until communications module is built; show empty state |
| G8 | **No cooperative governance admin API** — can't create elections, record meeting minutes, create resolutions via API | Admin: Cooperative Management | **Medium** | Add admin CRUD endpoints for elections, meetings, resolutions |
| G9 | **No KYC status update API** — admins can't approve/reject KYC submissions | Admin: KYC Management (Compliance) | **Medium** | Add `/api/admin/customers/[id]/kyc` PATCH endpoint |
| G10 | **No wallet funding/withdrawal API** — by design (Safe Haven), but sandbox needs a mock flow | Customer: Wallet | **Low** | Add mock wallet deposit endpoint for sandbox testing |

**Total: 10 API gaps. 4 are blockers (G1-G4) for launch-critical screens.**

---

## Screen Inventory — Customer App

Route group: `(app)/` — authenticated customers only.  
Navigation: Bottom tab bar (mobile) / sidebar (desktop).  
Tabs: Home, Savings, Loans, Cooperative, Profile

### C1. Dashboard / Home
**Route:** `/dashboard`  
**Priority:** 🔴 Launch-critical  
**Roles:** All authenticated customers

**Content:**
- Wallet balance card (available, pending, reserved breakdown)
- Quick actions: Save, Borrow, Invest, Join Cooperative
- Active savings accounts summary (total balance, interest earned)
- Active loans summary (outstanding, next payment, status)
- Investment portfolio summary (total value, returns)
- Cooperative membership badge (if member)
- Recent transactions (last 5)

**API dependencies:**
- `G1` `/api/me` — **GAP: needs to be built**
- GET `/api/wallets/[walletId]/balance`
- GET `/api/savings/accounts`
- GET `/api/loans`
- GET `/api/investments/accounts`
- GET `/api/cooperatives`
- GET `/api/wallets/[walletId]/transactions`

**Loading/Error/Empty:**
- Loading: Skeleton cards for each section
- Error: "Couldn't load your dashboard. Pull to retry." with retry button
- Empty (new user): Welcome card with "Start by opening a savings account" CTA

### C2. Wallet / Transaction History
**Route:** `/wallet`  
**Priority:** 🔴 Launch-critical  
**Roles:** All authenticated customers

**Content:**
- Full wallet balance (4D breakdown: available, ledger, reserved, pending)
- Transaction history list (filterable by type, date range)
- Each transaction: type, amount (debit/credit), date, status, description
- Fund wallet button (Safe Haven integration — `G10` mock for sandbox)
- Withdraw button (Safe Haven integration — `G10` mock for sandbox)

**API dependencies:**
- `G1` `/api/me` (for wallet ID)
- GET `/api/wallets/[walletId]/balance`
- GET `/api/wallets/[walletId]/transactions`
- `G10` Wallet funding/withdrawal — **GAP: mock needed for sandbox**

**Loading/Error/Empty:**
- Loading: Skeleton list
- Error: "Couldn't load transactions. Tap to retry."
- Empty: "No transactions yet. Fund your wallet to get started."

### C3. Savings — Browse Products
**Route:** `/savings`  
**Priority:** 🔴 Launch-critical  
**Roles:** All authenticated customers

**Content:**
- Product cards: name, interest rate, lock period, min/max, description
- "Open Account" CTA per product
- Filter/sort by rate, lock period

**API dependencies:**
- GET `/api/savings/products`

### C4. Savings — Open Account
**Route:** `/savings/[productId]/open`  
**Priority:** 🔴 Launch-critical  
**Roles:** All authenticated customers

**Content:**
- Product summary (rate, terms, lock period)
- Initial deposit input (with min/max validation from product config)
- Account nickname (optional)
- Terms acceptance checkbox
- Submit → creates savings account → redirect to account detail

**API dependencies:**
- GET `/api/savings/products` (for product details)
- POST `/api/savings/accounts` (create account)

### C5. Savings — Account Detail
**Route:** `/savings/accounts/[accountId]`  
**Priority:** 🔴 Launch-critical  
**Roles:** Account owner

**Content:**
- Balance + interest earned
- Account terms (product, rate, lock period, maturity date if applicable)
- Deposit / Withdraw buttons (disabled if locked)
- Transaction history for this account
- Interest accrual display

**API dependencies:**
- GET `/api/savings/accounts/[accountId]`
- POST `/api/savings/accounts/[accountId]/deposit`
- POST `/api/savings/accounts/[accountId]/withdraw`

### C6. Loans — Browse Products
**Route:** `/loans`  
**Priority:** 🔴 Launch-critical  
**Roles:** All authenticated customers

**Content:**
- Product cards: name, rate, max amount (based on savings multiplier), term, requirements
- "Apply Now" CTA per product
- Eligibility indicator (does customer meet savings threshold?)

**API dependencies:**
- GET `/api/loans/products`
- `G1` `/api/me` (for savings balance to show eligibility)

### C7. Loans — Apply
**Route:** `/loans/[productId]/apply`  
**Priority:** 🔴 Launch-critical  
**Roles:** All authenticated customers

**Content:**
- Loan calculator (amount, term → monthly payment, total interest) — **display only, no client-side decisioning**
- Product requirements checklist (savings multiplier, cooperative membership if required)
- Application form (amount, term, purpose)
- Risk disclosure acceptance
- Submit → creates loan application → redirect to loan detail

**API dependencies:**
- GET `/api/loans/products`
- POST `/api/loans` (apply)
- `G1` `/api/me` (for savings balance display)

### C8. Loans — Loan Detail
**Route:** `/loans/[loanId]`  
**Priority:** 🔴 Launch-critical  
**Roles:** Loan applicant

**Content:**
- Loan status (pending, active, overdue, etc.)
- Loan terms (amount, rate, term, monthly payment)
- Outstanding balance + next payment due
- Repayment schedule (table: due date, amount, status)
- Repay button (if active)
- Eligibility decision display (if pending, show what was evaluated)

**API dependencies:**
- GET `/api/loans/[loanId]`
- POST `/api/loans/[loanId]/repay`

### C9. Cooperative — Browse / Join
**Route:** `/cooperative`  
**Priority:** 🟡 Important  
**Roles:** All authenticated customers

**Content:**
- List of available cooperatives
- Cooperative details (name, description, member count)
- Membership status (if already a member)
- Join button (if not a member)

**API dependencies:**
- GET `/api/cooperatives`
- POST `/api/cooperatives/[coopId]/join`

### C10. Cooperative — Dashboard
**Route:** `/cooperative/[coopId]`  
**Priority:** 🟡 Important  
**Roles:** Cooperative members

**Content:**
- Membership status (active, join date, role)
- Executive positions (who holds what)
- Active elections (if any) — with vote button
- Recent meetings + resolutions
- Group savings accounts for this cooperative
- Esusu groups for this cooperative

**API dependencies:**
- GET `/api/cooperatives/[coopId]`
- GET `/api/cooperatives/[coopId]/elections`
- GET `/api/cooperatives/[coopId]/meetings`
- GET `/api/cooperatives/[coopId]/resolutions`
- GET `/api/group-savings/accounts` (filtered by cooperative)
- GET `/api/esusu/[groupId]`

### C11. Cooperative — Vote in Election
**Route:** `/cooperative/[coopId]/elections/[electionId]`  
**Priority:** 🟡 Important  
**Roles:** Cooperative members with voting rights

**Content:**
- Election details (position, candidates, voting period)
- Candidate list with profiles
- Cast vote (one vote per member)
- Vote confirmation (irreversible — show warning)

**API dependencies:**
- GET `/api/cooperatives/[coopId]/elections`
- POST `/api/cooperatives/[coopId]/elections/[electionId]/vote`

### C12. Group Savings — Account Detail
**Route:** `/group-savings/accounts/[accountId]`  
**Priority:** 🟡 Important  
**Roles:** Group members

**Content:**
- Group savings product info (type: equal share, common pool, seasonal, emergency)
- Pool balance (total contributed)
- Member list with individual contributions
- Contribution schedule (next due date, amount)
- Contribute button
- Payout/distribution info (when applicable)

**API dependencies:**
- GET `/api/group-savings/accounts/[accountId]`
- POST `/api/group-savings/accounts/[accountId]/contribute`

### C13. Esusu — Group Detail
**Route:** `/esusu/[groupId]`  
**Priority:** 🟡 Important  
**Roles:** Esusu group members

**Content:**
- Esusu group info (contribution amount, cycle length, rotation order)
- Current cycle status (whose turn is it, next payout date)
- Rotation schedule (all members in order, their payout dates)
- Contribution status per member (paid, pending, missed)
- Payout history

**API dependencies:**
- GET `/api/esusu/[groupId]`

### C14. Investments — Browse Products
**Route:** `/investments`  
**Priority:** 🟡 Important  
**Roles:** All authenticated customers

**Content:**
- Product cards: name, return type (guaranteed/variable/expected), rate, risk level, term
- Risk level indicator (Low/Moderate/High)
- "Invest Now" CTA per product
- Clear distinction between guaranteed and variable returns

**API dependencies:**
- GET `/api/investments/products`

### C15. Investments — Subscribe (with Risk disclosure)
**Route:** `/investments/[productId]/subscribe`  
**Priority:** 🟡 Important  
**Roles:** All authenticated customers

**Content:**
- Product summary (rate, term, risk level, return guarantee type)
- **Mandatory risk disclosure** — full text displayed, must scroll and accept
- Investment amount input (with min/max from product config)
- Auto-reinvest toggle (if applicable)
- Terms acceptance
- Submit → creates investment account → redirect to account detail

**API dependencies:**
- GET `/api/investments/products`
- POST `/api/investments/accounts` (subscribe — includes risk disclosure acceptance)

### C16. Investments — Portfolio
**Route:** `/investments/portfolio`  
**Priority:** 🟡 Important  
**Roles:** Investors

**Content:**
- Portfolio summary (total AUM, total returns, guaranteed vs. variable breakdown)
- Account cards: product, current value, status (active/matured), returns earned
- Per-account actions: View, Redeem (if matured), Rollover (if matured)

**API dependencies:**
- GET `/api/investments/accounts`

### C17. Investments — Account Detail
**Route:** `/investments/accounts/[accountId]`  
**Priority:** 🟡 Important  
**Roles:** Account owner

**Content:**
- Investment terms (product, rate, term, maturity date, return guarantee type)
- Current value + returns earned
- Transaction history (subscription, returns, fees)
- Redeem button (if matured)
- Rollover button (if matured)

**API dependencies:**
- GET `/api/investments/accounts/[accountId]`
- POST `/api/investments/accounts/[accountId]/redeem`
- POST `/api/investments/accounts/[accountId]/rollover`

### C18. Notifications / Inbox
**Route:** `/notifications`  
**Priority:** 🟢 Can follow  
**Roles:** All authenticated customers

**Content:**
- Notification list (transaction alerts, loan reminders, election notices, maturity alerts)
- Mark as read
- Filter by type

**API dependencies:**
- `G7` **GAP: No notifications API exists** — communications module is a stub

**Recommendation:** Build the screen shell with an empty state ("No notifications yet") and defer the backend until communications module is built.

### C19. Profile / Settings
**Route:** `/profile`  
**Priority:** 🔴 Launch-critical  
**Roles:** All authenticated customers

**Content:**
- Profile info (name, email, phone, avatar)
- KYC status (level 0-3, verification status)
- Cooperative membership(s)
- Security settings (change password, 2FA if available)
- Logout

**API dependencies:**
- `G1` `/api/me` — **GAP: needs to be built**
- Supabase Auth (for password management, session)

---

## Screen Inventory — Admin Console

Route group: `(admin)/` — authenticated staff only.  
Navigation: Sidebar with role-based menu items.  
Access control: Middleware checks staff role + feature access.

### A1. Admin Dashboard
**Route:** `/admin`  
**Priority:** 🔴 Launch-critical  
**Roles:** Super Admin, Operations, Finance

**Content:**
- Portfolio summary (total deposits, loans outstanding, AUM, group savings)
- Loan portfolio (active, overdue, default rate)
- Savings portfolio (total balance, active accounts)
- Investment portfolio (guaranteed AUM, variable pool AUM — SEPARATE)
- Group savings & Esusu status
- Cooperative membership count
- Staff count + role distribution
- Product count by module

**API dependencies:**
- GET `/api/admin/dashboard`

### A2. Audit Log Viewer
**Route:** `/admin/audit`  
**Priority:** 🔴 Launch-critical  
**Roles:** Super Admin, Compliance

**Content:**
- Filterable audit log table (actor, action, entity, date range, result)
- Log type selector: General / Governance / Admin Actions
- Summary mode (aggregate statistics)
- Pagination
- Export to CSV

**API dependencies:**
- GET `/api/admin/audit?log_type=audit|governance|admin&...`
- GET `/api/admin/reports/audit_financial_transactions?format=csv`

### A3. Compliance Reports
**Route:** `/admin/compliance`  
**Priority:** 🔴 Launch-critical  
**Roles:** Super Admin, Finance, Compliance

**Content:**
- Total Deposits Held (traceable to Ledger — show account breakdown)
- Total Loans Outstanding (traceable to Ledger)
- Reconciliation Status (matched, unmatched, flagged, resolved, pending)
- KYC Status (level distribution, pending reviews)
- Export each report as CSV/JSON

**API dependencies:**
- GET `/api/admin/compliance?type=all`
- GET `/api/admin/reports/compliance_total_deposits?format=csv`
- GET `/api/admin/reports/compliance_loans_outstanding?format=csv`

### A4. Risk / Portfolio Views
**Route:** `/admin/risk`  
**Priority:** 🟡 Important  
**Roles:** Super Admin, Finance, Loan Officer

**Content:**
- Default rate by loan product (bar chart)
- Savings-to-loan ratio (gauge/metric)
- Investment pool performance — **guaranteed and variable SEPARATE sections**
- Credit score distribution (histogram)

**API dependencies:**
- GET `/api/admin/risk?type=all`

### A5. Product Configuration — Savings
**Route:** `/admin/products/savings`  
**Priority:** 🔴 Launch-critical (admin)  
**Roles:** Super Admin, Operations

**Content:**
- Product list table (code, name, rate, lock period, status)
- Create new product form
- Edit product form
- Toggle active/inactive

**API dependencies:**
- GET `/api/savings/products`
- `G2` **GAP: No POST/PUT/DELETE** — needs product config CRUD API

### A6. Product Configuration — Loans
**Route:** `/admin/products/loans`  
**Priority:** 🔴 Launch-critical (admin)  
**Roles:** Super Admin, Operations

**Content:**
- Product list table (code, name, rate, max multiplier, term, status)
- Create/edit product form

**API dependencies:**
- GET `/api/loans/products`
- `G2` **GAP: No POST/PUT/DELETE**

### A7. Product Configuration — Investments
**Route:** `/admin/products/investments`  
**Priority:** 🟡 Important  
**Roles:** Super Admin, Operations

**Content:**
- Product list table (code, name, return guarantee type, rate, risk level, status)
- Create/edit product form
- Pool performance entry (for variable_pool products)
- Distribution trigger (for variable_pool products)

**API dependencies:**
- GET `/api/investments/products`
- POST `/api/investments/products/[id]/performance`
- POST `/api/investments/products/[id]/distribute`
- `G2` **GAP: No POST/PUT for product CRUD** (performance/distribute exist)

### A8. Product Configuration — Group Savings
**Route:** `/admin/products/group-savings`  
**Priority:** 🟡 Important  
**Roles:** Super Admin, Operations

**Content:**
- Product list table (code, name, type, status)
- Create/edit product form

**API dependencies:**
- GET `/api/group-savings/products`
- `G2` **GAP: No POST/PUT/DELETE**

### A9. RBAC / User Management
**Route:** `/admin/staff`  
**Priority:** 🔴 Launch-critical (admin)  
**Roles:** Super Admin only

**Content:**
- Staff user list (name, email, role, status)
- Create staff user form (name, email, role assignment)
- Edit role assignment
- Activate/deactivate staff

**API dependencies:**
- `G3` **GAP: No staff management API** — needs CRUD endpoints

### A10. Loan Officer Review / Override
**Route:** `/admin/loans/[loanId]`  
**Priority:** 🔴 Launch-critical (admin)  
**Roles:** Loan Officer, Super Admin

**Content:**
- Loan application details (applicant, amount, product, term)
- Eligibility decision display (savings score, credit score, cooperative participation, outcome)
- **Approve / Reject buttons** with **mandatory reason field** (visible, not hidden)
- Override eligibility decision with **mandatory reason + audit trail notice** (transparency: "This override will be permanently recorded in the audit log")
- Disburse button (if approved)
- Repayment schedule view

**API dependencies:**
- GET `/api/loans/[loanId]`
- POST `/api/loans/[loanId]/disburse`
- `G4` **GAP: No review/override API** — needs POST endpoint with reason field + audit logging

### A11. Customer Support Tools
**Route:** `/admin/customers` and `/admin/customers/[customerId]`  
**Priority:** 🟡 Important  
**Roles:** Customer Support, Super Admin

**Content:**
- Customer search (by name, email, phone)
- Customer profile view (KYC status, wallet balance, accounts summary)
- Read-only views of: wallet transactions, savings accounts, loan accounts, investment accounts
- Support ticket creation (future)

**API dependencies:**
- `G5` **GAP: No admin customer search/lookup API** — needs GET with search + detail endpoint

### A12. Reconciliation Management
**Route:** `/admin/reconciliation`  
**Priority:** 🟡 Important  
**Roles:** Finance, Super Admin

**Content:**
- Reconciliation flags table (date, wallet, amount, status, matched/unmatched)
- Filter by status (pending, flagged, resolved)
- Resolve flag action with reason
- Summary stats (matched rate, pending count)

**API dependencies:**
- GET `/api/admin/reconciliation-flags`
- `G6` **GAP: No resolution API** — needs POST resolve endpoint

### A13. Report Generation / Export
**Route:** `/admin/reports`  
**Priority:** 🟡 Important  
**Roles:** Super Admin, Finance, Compliance (role-filtered)

**Content:**
- Report catalog (filtered by user's role)
- Generate report (with parameters)
- Export as CSV or JSON
- Report generation history (who generated what, when)

**API dependencies:**
- GET `/api/admin/reports`
- GET `/api/admin/reports/[reportKey]?format=csv|json`

### A14. Cooperative Management (Admin)
**Route:** `/admin/cooperative/[coopId]`  
**Priority:** 🟢 Can follow  
**Roles:** Super Admin, Operations

**Content:**
- Cooperative details + member list
- Create/manage elections
- Record meeting minutes
- Create/manage resolutions
- Manage executive positions

**API dependencies:**
- GET `/api/cooperatives/[coopId]`
- `G8` **GAP: No admin governance CRUD APIs**

---

## Priority Summary

### 🔴 Launch-Critical (must have for v1)
| Screen | Route | API Gap Blocker? |
|---|---|---|
| Dashboard | `/dashboard` | G1 |
| Wallet / Transactions | `/wallet` | G1 |
| Savings Browse | `/savings` | — |
| Savings Open Account | `/savings/[productId]/open` | — |
| Savings Account Detail | `/savings/accounts/[accountId]` | — |
| Loans Browse | `/loans` | G1 |
| Loans Apply | `/loans/[productId]/apply` | — |
| Loans Detail | `/loans/[loanId]` | — |
| Profile / Settings | `/profile` | G1 |
| Admin Dashboard | `/admin` | — |
| Admin Audit Log | `/admin/audit` | — |
| Admin Compliance | `/admin/compliance` | — |
| Admin Product Config (Savings) | `/admin/products/savings` | G2 |
| Admin Product Config (Loans) | `/admin/products/loans` | G2 |
| Admin RBAC / User Mgmt | `/admin/staff` | G3 |
| Admin Loan Review/Override | `/admin/loans/[loanId]` | G4 |

### 🟡 Important (should have for v1)
| Screen | Route | API Gap Blocker? |
|---|---|---|
| Cooperative Browse/Join | `/cooperative` | — |
| Cooperative Dashboard | `/cooperative/[coopId]` | — |
| Cooperative Vote | `/cooperative/[coopId]/elections/[electionId]` | — |
| Group Savings Detail | `/group-savings/accounts/[accountId]` | — |
| Esusu Detail | `/esusu/[groupId]` | — |
| Investments Browse | `/investments` | — |
| Investments Subscribe | `/investments/[productId]/subscribe` | — |
| Investments Portfolio | `/investments/portfolio` | — |
| Investments Account Detail | `/investments/accounts/[accountId]` | — |
| Admin Risk Views | `/admin/risk` | — |
| Admin Product Config (Investments) | `/admin/products/investments` | G2 |
| Admin Product Config (Group Savings) | `/admin/products/group-savings` | G2 |
| Admin Customer Support | `/admin/customers` | G5 |
| Admin Reconciliation | `/admin/reconciliation` | G6 |
| Admin Reports | `/admin/reports` | — |

### 🟢 Can Follow (post-v1)
| Screen | Route | API Gap Blocker? |
|---|---|---|
| Notifications / Inbox | `/notifications` | G7 |
| Admin Cooperative Mgmt | `/admin/cooperative/[coopId]` | G8 |

---

## Flow Map — Customer Journey

```
Landing → Signup → Onboarding (KYC) → Dashboard
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
              Savings            Loans            Cooperative
                │                  │                  │
        Browse Products    Browse Products    Browse/Join
                │                  │                  │
        Open Account       Apply (eligibility)  Dashboard
                │                  │                  │
        Account Detail     Loan Detail        Vote / Group Savings
         (deposit/withdraw)  (repay)           / Esusu
                │
        (history)

                    ┌─────────────────┐
                    ↓                 ↓
              Investments         Profile/Settings
                │                  │
        Browse Products    KYC Status
                │            Security
        Subscribe          Logout
        (risk disclosure)
                │
        Portfolio
        (redeem / rollover)
```

## Flow Map — Admin Journey

```
Admin Login → Dashboard (role-filtered)
                    ↓
        ┌───────────┼───────────────┬──────────────┐
        ↓           ↓               ↓              ↓
    Audit Log   Compliance      Products       RBAC/Users
                Reports          (Savings/Loans/   (Super Admin)
                (Compliance)     Investments/
                                 Group Savings)
                                        ↓
                                 ┌──────┼──────┐
                                 ↓      ↓      ↓
                            Loan    Customer  Reconciliation
                           Review   Support   Management
                          (Officer) (Support)  (Finance)
```

---

## Design System Foundation (Proposed)

### Design Tokens
- **Colors:** Existing brand palette (Deep Green #0B6B3A, Gold #D4A574, Light Green #4CAF50) + semantic (success/warning/danger) + shadcn/ui CSS variables
- **Typography:** System font stack (no custom font load — performance for low-bandwidth)
- **Spacing:** Tailwind default (4px base)
- **Border radius:** 8px (cards), 6px (buttons/inputs), 12px (modals)
- **Shadows:** Subtle (trust-building, not flashy)

### Core Components (planned)
- `MoneyDisplay` — formats Naira, shows debit/credit with color
- `StatusBadge` — loan/savings/investment status with color coding
- `DateDisplay` — Nigerian date format (DD/MM/YYYY)
- `DataTable` — sortable, filterable, paginated
- `ProductCard` — savings/loan/investment product display
- `AmountInput` — currency input with min/max validation
- `LoadingState` — skeleton/spinner pattern
- `ErrorState` — error message with retry
- `EmptyState` — empty state with CTA
- `TabBar` — mobile bottom navigation
- `Sidebar` — admin sidebar with role-based items
- `ConfirmationDialog` — irreversible action confirmation (vote, redeem, override)

### Responsive Strategy
- Mobile-first (target: 360px minimum width)
- Bottom tab bar for customer app (5 tabs: Home, Savings, Loans, Coop, Profile)
- Sidebar for admin console (collapsible on mobile)
- No horizontal scroll — all content stacks vertically on narrow screens
- Touch-friendly: 44px minimum tap targets

---

## Architecture Decisions (Proposed for ADR)

1. **Customer app and admin console as separate route groups** (`(app)/` and `(admin)/`) within the same Next.js app — sharing component library but separate layouts, navigation, and middleware-level access control
2. **React Query for server state** — already installed, use for all API data fetching with proper cache invalidation
3. **No client-side business logic** — all calculations server-side; frontend displays results
4. **PWA for v1** — service worker for offline shell, cached static assets, installable
5. **Component library** — shadcn/ui pattern (already set up) + domain-specific components (MoneyDisplay, StatusBadge, etc.)
6. **Form handling** — react-hook-form + zod (already installed) for all forms
7. **Optimistic UI** — for actions like deposit/withdraw/vote, show optimistic result then reconcile with server response (not parallel logic)

---

## Summary for CTO Decision

1. **Screen inventory:** 19 customer screens + 14 admin screens = 33 total
2. **API gaps:** 10 identified, 4 are blockers (G1-G4)
3. **Recommendation:** Build G1-G4 API endpoints first (small backend additions), then proceed with frontend implementation
4. **Web vs. Native:** PWA for v1, native for v2 based on user research
5. **Design system:** Existing brand palette + shadcn/ui + domain components

**Awaiting CTO approval before writing any UI code.**
