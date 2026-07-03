# AgroCycle — Complete Requirements Specification
## Everything We Need to Build v1 (Functional MVP)
**Date:** July 3, 2026  
**Status:** Planning Phase  
**Approach:** Web app + PWA, built on Base44 backend

---

## 1. FUNCTIONAL REQUIREMENTS

### 1.1 User Account Management

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-U01 | User can register with phone number + OTP verification | P0 | Phone is primary identifier |
| FR-U02 | User can complete KYC with BVN + selfie verification | P0 | Via Smile ID or VerifyMe API |
| FR-U03 | User can login with phone + OTP (no passwords) | P0 | Frictionless for target users |
| FR-U04 | User can update profile (name, email, profile photo) | P1 | |
| FR-U05 | User can view their credit score | P2 | Phase 2 — needs savings history first |
| FR-U06 | Admin can suspend/activate user accounts | P1 | Platform admin only |
| FR-U07 | User can delete their account (with balance withdrawal first) | P2 | |
| FR-U08 | System enforces BVN uniqueness (one account per BVN) | P0 | Fraud prevention |

### 1.2 Personal Savings (Core Product)

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-S01 | User can create a Flex Savings account (deposit/withdraw anytime) | P0 | Default account on signup |
| FR-S02 | User can create a Goal Savings account with target amount + target date | P0 | e.g. "Planting Season — ₦150k by September" |
| FR-S03 | User can set lock type on goals (soft lock = lose interest on early withdrawal, hard lock = cannot withdraw until date) | P1 | Discipline mechanism |
| FR-S04 | User can deposit money into any savings account via Paystack (card or bank transfer) | P0 | Core money flow |
| FR-S05 | User can withdraw money from Flex Savings to their bank account | P0 | Via Paystack Transfer |
| FR-S06 | User can withdraw from soft-locked goals (with interest penalty) | P1 | |
| FR-S07 | User cannot withdraw from hard-locked goals until unlock date | P1 | Enforced server-side |
| FR-S08 | User can set up automated recurring deposits (daily/weekly/monthly) | P1 | Via Paystack mandate |
| FR-S09 | User can view savings progress (current amount vs target, percentage, days remaining) | P0 | Visual progress tracker |
| FR-S10 | System auto-creates Flex Savings account on user registration | P0 | Every user starts with one |
| FR-S11 | User can create Seasonal Vault (pre-built templates: Planting, Growing, Harvest) | P1 | Agro-specific feature |
| FR-S12 | User can create Stash account for micro-savings (₦100-500/day) | P2 | |
| FR-S13 | System pays interest on savings (configured rate per account type) | P1 | From partner bank float |
| FR-S14 | User can close a savings account (withdraw balance first) | P2 | |
| FR-S15 | System sends notification when goal is reached | P1 | Celebration + suggest next goal |

### 1.3 Group Savings (Feature)

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-G01 | User can create a savings group (cycle/challenge/emergency) | P1 | Phase 2, but design DB now |
| FR-G02 | User can invite members via shareable link | P1 | WhatsApp-friendly link |
| FR-G03 | Members can join group via invite link | P1 | |
| FR-G04 | Admin can set contribution amount, frequency, payout method | P1 | |
| FR-G05 | System generates payment links for each member per cycle | P1 | Money goes peer-to-peer, not through us |
| FR-G06 | System tracks who has paid, who hasn't, who's next for payout | P1 | Visual rotation tracker |
| FR-G07 | System sends reminders before contribution due dates | P1 | SMS + WhatsApp + in-app |
| FR-G08 | Admin can verify/reject member payment receipts | P1 | Dispute handling |
| FR-G09 | Member can flag a missing or incorrect payment | P2 | Dispute resolution |
| FR-G10 | System generates cycle completion report | P2 | |
| FR-G11 | Members can rate each other after cycle completion | P2 | Feeds into credit score |

### 1.4 Transactions & Payments

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-T01 | User can deposit via Paystack (card payment) | P0 | Primary payment method |
| FR-T02 | User can deposit via Paystack (bank transfer) | P1 | Paystack bank transfer option |
| FR-T03 | User can deposit via Paystack (USSD) | P2 | For feature phone users |
| FR-T04 | User can withdraw to their bank account via Paystack Transfer | P0 | |
| FR-T05 | User can view full transaction history (filterable by type, date, account) | P0 | |
| FR-T06 | User can view individual transaction details (receipt) | P0 | |
| FR-T07 | System creates pending transaction record before payment | P0 | Audit trail starts before payment |
| FR-T08 | System updates transaction to completed only after Paystack webhook confirms | P0 | Never trust frontend |
| FR-T09 | System handles failed payments (mark as failed, notify user) | P0 | |
| FR-T10 | System handles payment retries (auto-retry failed auto-saves after 2 days) | P1 | |
| FR-T11 | System charges withdrawal fee (1% or flat fee, configurable) | P1 | Revenue stream |
| FR-T12 | First 3 withdrawals per month are free (then fee applies) | P2 | Premium feature |
| FR-T13 | User receives SMS + in-app notification for every transaction | P0 | Trust building |

### 1.5 Notifications

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-N01 | System sends deposit confirmation notification | P0 | |
| FR-N02 | System sends withdrawal confirmation notification | P0 | |
| FR-N03 | System sends savings reminders (before auto-save date) | P1 | |
| FR-N04 | System sends goal milestone notifications (25%, 50%, 75%, 100%) | P1 | Motivation |
| FR-N05 | System sends group contribution reminders | P1 | |
| FR-N06 | System sends group payout notifications | P1 | |
| FR-N07 | User can view in-app notification history | P0 | |
| FR-N08 | User can mark notifications as read | P1 | |
| FR-N09 | System sends OTP via SMS for authentication | P0 | |
| FR-N10 | Notifications delivered via SMS + in-app (WhatsApp in Phase 2) | P0 | |

### 1.6 Dashboard & Analytics

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-D01 | User dashboard shows total savings balance across all accounts | P0 | |
| FR-D02 | User dashboard shows individual account balances | P0 | |
| FR-D03 | User dashboard shows recent transactions (last 10) | P0 | |
| FR-D04 | User dashboard shows active savings goals with progress bars | P0 | |
| FR-D05 | User dashboard shows savings stats (total saved, total withdrawn, interest earned) | P1 | |
| FR-D06 | User can view savings history chart (monthly deposits over time) | P2 | |
| FR-D07 | Admin dashboard shows platform-wide stats (total users, AUM, transactions) | P1 | Platform admin only |

### 1.7 Admin / Platform Management

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-A01 | Platform admin can view all users | P1 | |
| FR-A02 | Platform admin can suspend/activate users | P1 | |
| FR-A03 | Platform admin can view all transactions | P1 | |
| FR-A04 | Platform admin can resolve disputes | P2 | |
| FR-A05 | Platform admin can configure interest rates and fees | P2 | |
| FR-A06 | Platform admin can view audit logs | P1 | |
| FR-A07 | Platform admin can send broadcast notifications | P2 | |

---

## 2. NON-FUNCTIONAL REQUIREMENTS

### 2.1 Security

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| NFR-SE01 | All API calls over HTTPS (TLS 1.2+) | P0 | Enforced by hosting (Vercel/Cloudflare) |
| NFR-SE02 | Passwordless auth via phone OTP (no passwords to steal) | P0 | |
| NFR-SE03 | JWT tokens with expiration for authenticated sessions | P0 | |
| NFR-SE04 | BVN numbers hashed before storage (never stored in plaintext) | P0 | |
| NFR-SE05 | Payment card data NEVER touches our servers (Paystack handles PCI-DSS) | P0 | |
| NFR-SE06 | All financial transactions verified server-side via Paystack webhook + API double-check | P0 | Never trust client |
| NFR-SE07 | Rate limiting on auth endpoints (max 5 OTP requests per phone per 10 min) | P0 | |
| NFR-SE08 | Rate limiting on transaction endpoints (max 10 deposits per hour per user) | P1 | Fraud prevention |
| NFR-SE09 | 2FA for admin panel access | P1 | |
| NFR-SE10 | IP whitelist for admin panel (optional) | P2 | |
| NFR-SE11 | Immutable audit log for every financial action | P0 | Regulatory requirement |
| NFR-SE12 | Encryption at rest for database (managed by hosting provider) | P0 | |
| NFR-SE13 | Session timeout after 30 minutes of inactivity | P1 | |
| NFR-SE14 | Automatic logout on suspicious activity (multiple IP access) | P2 | |

### 2.2 Performance

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| NFR-P01 | Page load time < 3 seconds on 3G connection | P0 | Target users have slow internet |
| NFR-P02 | API response time < 500ms for read operations | P0 | |
| NFR-P03 | API response time < 2s for payment operations (Paystack round-trip) | P0 | |
| NFR-P04 | Dashboard loads with skeleton states (progressive loading) | P1 | Don't blank-screen while fetching |
| NFR-P05 | Images optimized (WebP, lazy-loaded) | P1 | |
| NFR-P06 | Support 500 concurrent users without degradation (MVP) | P0 | Pilot scale |
| NFR-P07 | Support 5,000 concurrent users (Phase 2) | P1 | |
| NFR-P08 | Database queries indexed on user_id, payment_reference, phone | P0 | |

### 2.3 Reliability & Availability

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| NFR-R01 | 99.5% uptime target for MVP | P0 | ~3.6 hours downtime/month max |
| NFR-R02 | Automated daily database backups | P0 | |
| NFR-R03 | Point-in-time database recovery (last 7 days) | P1 | |
| NFR-R04 | Graceful error handling — no raw error messages to users | P0 | |
| NFR-R05 | Payment webhook idempotency (processing same webhook twice = no double credit) | P0 | Critical for money |
| NFR-R06 | Paystack webhook retry handling (if our endpoint is down, Paystack retries) | P0 | |
| NFR-R07 | Health check endpoint for monitoring | P1 | |
| NFR-R08 | Error alerting (Sentry/Datadog notifies on errors) | P0 | |
| NFR-R09 | Disaster recovery plan documented | P2 | |
| NFR-R10 | Fallback payment processor (Flutterwave) if Paystack is down | P2 | |

### 2.4 Usability

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| NFR-U01 | Mobile-first responsive design (80%+ users on mobile) | P0 | |
| NFR-U02 | Works on low-end Android devices (Chrome 80+) | P0 | Target user reality |
| NFR-U03 | PWA installable on home screen (app-like experience) | P0 | |
| NFR-U04 | Offline shell (service worker caches app shell) | P1 | App loads even without internet, shows cached data |
| NFR-U05 | Simple, clean UI — no more than 3 taps to deposit money | P0 | |
| NFR-U06 | Nigerian English + Pidgin-friendly language in UI | P1 | Speak their language |
| NFR-U07 | Currency displayed as ₦ with proper formatting | P0 | |
| NFR-U08 | Large tap targets (min 44px) for users with bigger fingers | P1 | |
| NFR-U09 | Clear error messages in plain language (not technical jargon) | P0 | |
| NFR-U10 | Loading states for all async operations | P0 | |
| NFR-U11 | Empty states with guidance (e.g. "No savings goals yet — create one!") | P1 | |
| NFR-U12 | Accessible (WCAG 2.1 AA — screen reader compatible, color contrast) | P2 | |

### 2.5 Scalability

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| NFR-SC01 | Stateless backend (horizontal scaling ready) | P0 | |
| NFR-SC02 | Database designed for scale (proper indexing, no N+1 queries) | P0 | |
| NFR-SC03 | Paginated API responses (max 50 records per page) | P0 | |
| NFR-SC04 | Background job queue for non-critical tasks (notifications, auto-save) | P1 | Don't block payment flow |
| NFR-SC05 | CDN for all static assets | P0 | Vercel handles this |
| NFR-SC06 | Caching for frequently accessed data (user dashboard) | P2 | Redis or edge cache |

### 2.6 Compliance & Legal

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| NFR-C01 | NDPR compliant (Nigeria Data Protection Regulation) | P0 | Data protection policy, user consent |
| NFR-C02 | User consent for data collection at signup | P0 | Explicit opt-in |
| NFR-C03 | Data retention policy (delete user data on account deletion) | P1 | |
| NFR-C04 | Terms of service displayed and accepted at signup | P0 | |
| NFR-C05 | Privacy policy displayed and accessible from app | P0 | |
| NFR-C06 | AML/CFT policy in place (anti-money laundering) | P1 | Required for financial services |
| NFR-C07 | Transaction records retained for minimum 7 years | P1 | Regulatory requirement |
| NFR-C08 | Audit trail immutable (cannot be deleted or modified) | P0 | |
| NFR-C09 | Partner bank MOU signed before holding user funds | P0 | Legal requirement |
| NFR-C10 | CAC company registration | P0 | Legal entity |
| NFR-C11 | Dispute resolution mechanism documented and accessible | P1 | |

### 2.7 Maintainability

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| NFR-M01 | Code versioned in Git (GitHub) | P0 | |
| NFR-M02 | CI/CD pipeline for automated deployments | P1 | GitHub Actions |
| NFR-M03 | Automated tests for payment flows (unit + integration) | P0 | Money code must be tested |
| NFR-M04 | Environment separation (development, staging, production) | P1 | |
| NFR-M05 | API documentation (OpenAPI/Swagger) | P2 | For future partner integrations |
| NFR-M06 | Code linting and formatting enforced (ESLint + Prettier) | P1 | |
| NFR-M07 | Error logging with context (Sentry) | P0 | |
| NFR-M08 | Feature flags for gradual rollouts | P2 | |

---

## 3. THIRD-PARTY SERVICES

### 3.1 Payment Processing

| Service | Purpose | When Needed | Pricing | Status |
|---|---|---|---|---|
| **Paystack** | Primary payment gateway (card, bank transfer, USSD) | MVP — Day 1 | 1.5% per local transaction (₦100 cap) | 🔴 Need account + API keys |
| **Flutterwave** | Backup payment processor | Phase 2 | 1.4% per local transaction | 🔴 Need account (later) |
| **Paystack Transfer** | Withdrawals/payouts to user bank accounts | MVP — Day 1 | ₦50-100 per transfer | Included with Paystack |

**What we need from Paystack:**
- Business account (not personal)
- API keys (Secret Key + Public Key)
- Webhook URL configured
- Transfer recipient verification enabled
- Recurring payment mandate API access (for auto-save)

### 3.2 Identity Verification (KYC)

| Service | Purpose | When Needed | Pricing | Status |
|---|---|---|---|---|
| **Smile ID** | BVN verification + selfie biometric matching | MVP — Phase 2 | ~₦200 per verification | 🔴 Need account |
| **VerifyMe Nigeria** | Alternative BVN + identity verification | MVP — Phase 2 | ~₦150 per verification | 🔴 Alternative |
| **Youverify** | Alternative KYC + AML checks | MVP — Phase 2 | ~₦200 per verification | 🔴 Alternative |

**What we need from KYC provider:**
- API credentials (API key + partner ID)
- BVN verification endpoint
- Selfie-to-BVN photo matching endpoint
- Webhook for async verification results

**MVP shortcut:** Can skip BVN verification for first 100 pilot users (just collect BVN, verify manually). Add automated verification before scaling.

### 3.3 Notifications

| Service | Purpose | When Needed | Pricing | Status |
|---|---|---|---|---|
| **Twilio** | SMS delivery (OTP, transaction alerts, reminders) | MVP — Day 1 | ~$0.05/SMS in Nigeria (~₦75) | 🔴 Need account |
| **WhatsApp Business API** | WhatsApp notifications + bot | Phase 2 | $0.005-0.08 per conversation | 🔴 Need account (later) |
| **Termii** | Alternative Nigerian SMS gateway (cheaper for local) | MVP — Day 1 | ~₦2-5 per SMS | 🔴 Alternative (recommended for Nigeria) |
| **SendGrid / Postmark** | Transactional emails (statements, receipts) | Phase 2 | $0.001/email | 🔴 Need account (later) |

**Recommendation:** Use Termii for SMS (Nigerian-focused, cheaper, better local delivery rates) instead of Twilio for MVP.

**What we need from SMS provider:**
- API key
- Sender ID (e.g. "AgroCycle" as SMS sender name)
- OTP template approval
- SMS delivery reports webhook

### 3.4 Partner Bank (Fund Custodian)

| Partner | Purpose | When Needed | Status |
|---|---|---|---|
| **Providus Bank** | Escrow account for user funds, float interest | MVP — before launch | 🔴 Need conversation |
| **Sterling Bank** | Alternative (agri-focused) | MVP — before launch | 🔴 Alternative |
| **Wema Bank** | Alternative (digital-first, ALAT) | MVP — before launch | 🔴 Alternative |
| **Any CBN-licensed MFB** | Easier to partner, less bureaucracy | MVP — before launch | 🔴 Alternative |

**What we need from partner bank:**
- Escrow/sub-account structure for user funds
- API for creating sub-accounts per user
- API for deposit confirmation (or we rely on Paystack webhooks)
- API for initiating transfers (or we use Paystack Transfer)
- Float interest arrangement (interest on pooled balance, split with us)
- NDIC insurance confirmation for user funds
- Signed MOU / partnership agreement

**MVP shortcut:** If partner bank integration takes too long, start with Paystack-only (users pay in via card/transfer, funds settle to your business account, you manually reconcile). Add partner bank escrow before scaling past 500 users.

### 3.5 Analytics & Monitoring

| Service | Purpose | When Needed | Pricing | Status |
|---|---|---|---|---|
| **Sentry** | Error tracking + performance monitoring | MVP — Day 1 | Free tier (5k errors/month) | 🟡 Free tier OK |
| **Mixpanel** | User behavior analytics | MVP — Day 1 | Free up to 20M events | 🟡 Free tier OK |
| **Google Analytics 4** | Web analytics | MVP — Day 1 | Free | 🟡 Free |
| **Uptime Robot** | Uptime monitoring | MVP — Day 1 | Free tier (50 monitors) | 🟡 Free |
| **Hotjar** | User session recordings | Phase 2 | Free tier | 🟡 Free tier OK |

### 3.6 Development & Deployment

| Service | Purpose | When Needed | Pricing | Status |
|---|---|---|---|---|
| **GitHub** | Code repository + CI/CD | MVP — Day 1 | Free for private repos (5 seats) | 🟢 Can start now |
| **Vercel** | Frontend hosting + CDN | MVP — Day 1 | Free tier (then $20/mo Pro) | 🟢 Can start now |
| **Base44** | Backend (entities, functions, automations) | MVP — Day 1 | Included in your plan | 🟢 Already set up |
| **Cloudflare** | DNS, DDoS protection, additional CDN | MVP — Day 1 | Free tier | 🟢 Can start now |
| **Namecheap** | Domain registration (agrocycle.ng) | MVP — Day 1 | ~₦15,000/year | 🔴 Need to register |

### 3.7 Other Services

| Service | Purpose | When Needed | Pricing | Status |
|---|---|---|---|---|
| **1Password** | Team password management | MVP — Day 1 | $7.99/user/month | 🔴 Need for security |
| **Figma** | UI/UX design | MVP — Day 1 | Free tier (3 projects) | 🟡 Free tier OK |
| **Google Workspace** | Business email (hello@agrocycle.ng) | MVP — Day 1 | $6/user/month | 🔴 Need domain first |
| **Notion / Linear** | Project management | MVP — Day 1 | Free tier | 🟡 Free |

---

## 4. TECH STACK

### 4.1 Frontend

| Component | Technology | Why | Cost |
|---|---|---|---|
| **Framework** | Next.js 14+ (React) | SSR for fast load, API routes, PWA support, huge ecosystem | Free (open source) |
| **Styling** | Tailwind CSS + shadcn/ui | Fast, consistent, accessible, theme-aware | Free |
| **State management** | Zustand + React Query | Lightweight, no boilerplate, great for server state | Free |
| **Forms** | React Hook Form + Zod | Type-safe form validation | Free |
| **PWA** | next-pwa | Service worker, offline support, installable | Free |
| **Charts** | Recharts | Savings progress charts | Free |
| **Icons** | Lucide React | Clean, consistent icons | Free |
| **Notifications** | Sonner (toast) | User feedback for actions | Free |

### 4.2 Backend

| Component | Technology | Why | Cost |
|---|---|---|---|
| **Platform** | Base44 | Managed backend, entities, backend functions, automations, file storage | Included in your plan |
| **Database** | Base44 entities (MongoDB) | Managed, auto-scaling, no setup needed | Included |
| **API layer** | Base44 backend functions | Deployable HTTP endpoints, TypeScript | Included |
| **Background jobs** | Base44 automations | Scheduled tasks (reminders, auto-save triggers) | Included |
| **File storage** | Base44 file storage | KYC documents, receipts, profile photos | Included |
| **Authentication** | Base44 auth + custom OTP | Phone-based OTP auth | Included |

### 4.3 External Integrations

| Integration | Method | When |
|---|---|---|
| **Paystack** | REST API calls from backend functions | MVP |
| **Smile ID / VerifyMe** | REST API calls from backend functions | Phase 2 |
| **Termii / Twilio (SMS)** | REST API calls from backend functions | MVP |
| **WhatsApp Business** | API calls from backend functions | Phase 2 |
| **Partner bank** | REST API (if available) or manual reconciliation | Phase 2 (or MVP if ready) |

### 4.4 DevOps & Infrastructure

| Component | Technology | Why | Cost |
|---|---|---|---|
| **Code hosting** | GitHub | Version control, CI/CD, collaboration | Free |
| **Frontend hosting** | Vercel | Best Next.js hosting, global CDN, auto-deploy | Free tier → $20/mo |
| **DNS** | Cloudflare | Fast DNS, DDoS protection, free SSL | Free |
| **CI/CD** | GitHub Actions | Auto-deploy on push to main | Free tier |
| **Monitoring** | Sentry + Uptime Robot | Error tracking + uptime | Free tiers |
| **Analytics** | Mixpanel + GA4 | User behavior | Free tiers |

### 4.5 Development Tools

| Tool | Purpose | Cost |
|---|---|---|
| **VS Code** | Code editor | Free |
| **Figma** | UI/UX design | Free tier |
| **Postman** | API testing | Free |
| **ESLint + Prettier** | Code quality | Free |
| **Jest + Playwright** | Testing | Free |
| **GitHub** | Version control | Free |

---

## 5. WHAT'S ALREADY DONE

| Item | Status | Notes |
|---|---|---|
| **Database: User entity** | ✅ Created | With KYC, credit score, savings totals |
| **Database: SavingsAccount entity** | ✅ Created | Flex, goal, vault, stash types |
| **Database: Transaction entity** | ✅ Created | Deposits, withdrawals, fees, interest |
| **Database: Notification entity** | ✅ Created | Multi-channel (SMS, WhatsApp, email, in-app) |
| **Database: SavingsGroup entity** | ✅ Created | Cycle, challenge, emergency types |
| **Database: GroupMember entity** | ✅ Created | Slot positions, reliability ratings |
| **Database: GroupContribution entity** | ✅ Created | Per-cycle contribution tracking |
| **Database: AuditLog entity** | ✅ Created | Immutable audit trail |
| **Backend: initializeDeposit function** | 🟡 Written, not deployed | Paystack payment initialization |
| **Backend: paystackWebhook function** | 🟡 Written, not deployed | Payment confirmation handler |
| **Frontend** | 🔴 Not started | |
| **Paystack integration** | 🔴 Waiting for API keys | |
| **SMS integration** | 🔴 Waiting for account | |
| **Domain** | 🔴 Not registered | |

---

## 6. WHAT YOU NEED TO PROVIDE (Action Items)

### Critical — Needed Before We Start Building (Week 1)

| # | Item | How to Get It | Est. Cost | Blocking? |
|---|---|---|---|---|
| 1 | **Paystack business account + API keys** | Register at paystack.com, complete business verification, get test + live keys | Free to register | ✅ YES — can't build payments without this |
| 2 | **Domain name** (agrocycle.ng or similar) | Register at namecheap.com or whois.hosting | ₦15,000/year | ✅ YES — needed for hosting, email, Paystack callback |
| 3 | **Termii account** (SMS gateway) | Register at termii.com, get API key + sender ID | Free to register, ~₦2-5/SMS | ✅ YES — needed for OTP |
| 4 | **CAC registration** (if not done) | Register company at cac.gov.ng or use a lawyer | ₦30,000-50,000 | ⚠️ Needed before going live (not for dev) |

### Important — Needed Before Launch (Week 3-4)

| # | Item | How to Get It | Est. Cost | Blocking? |
|---|---|---|---|---|
| 5 | **Smile ID account** (BVN verification) | Register at smileidentity.com, get API keys | Free to register, ~₦200/verification | ⚠️ Needed before scaling (can manual-verify pilot users) |
| 6 | **Partner bank conversation** | Reach out to Providus, Sterling, or Wema Bank fintech partnerships | Time investment | ⚠️ Needed before holding user funds |
| 7 | **Google Workspace** (business email) | Sign up at workspace.google.com after domain registration | $6/user/month | No — can use personal email for dev |
| 8 | **Legal docs** (T&Cs, privacy policy, NDPR) | Engage a fintech lawyer | ₦150,000-300,000 | ⚠️ Needed before going live |
| 9 | **1Password** (password management) | Sign up at 1password.com | $7.99/user/month | No — but strongly recommended |

### Can Wait — Phase 2

| # | Item | Notes |
|---|---|---|
| 10 | **Flutterwave account** (backup processor) | Get after Paystack is working |
| 11 | **WhatsApp Business API** | Add when ready for WhatsApp notifications |
| 12 | **Partner bank API integration** | Add when MOU is signed |
| 13 | **SendGrid** (email) | Add when email statements are needed |

---

## 7. BUILD SEQUENCE (Dependency Order)

```
Phase 0: Setup (Week 1)
├── Register domain
├── Get Paystack test keys
├── Get Termii account
├── Set up GitHub repo
└── Set up Vercel project

Phase 1: Auth & User (Week 1-2)
├── Phone OTP registration → depends on Termii
├── Login/logout
├── Profile creation
├── Auto-create Flex Savings on signup
└── BVN collection (store, verify manually for pilot)

Phase 2: Savings Core (Week 2-3)
├── Flex Savings (view balance)
├── Deposit flow → depends on Paystack
│   ├── initializeDeposit function → ALREADY WRITTEN
│   ├── paystackWebhook function → ALREADY WRITTEN
│   └── Frontend deposit UI
├── Create Goal Savings
├── View savings dashboard
└── Transaction history

Phase 3: Withdrawal (Week 3-4)
├── Add bank account (Paystack Transfer recipient)
├── Withdrawal flow → depends on Paystack Transfer
├── Withdrawal fee calculation
└── Withdrawal notifications

Phase 4: Notifications & Polish (Week 4)
├── In-app notification center
├── SMS notifications for transactions → depends on Termii
├── Savings milestone notifications
├── Goal progress UI
└── Empty states, loading states, error handling

Phase 5: Group Savings (Week 5-6) — Phase 2 of product
├── Create group
├── Invite members
├── Contribution tracking
├── Payout rotation
└── Group dashboard

Phase 6: Pre-Launch (Week 6-7)
├── Security review / pentest
├── Legal docs finalized
├── Paystack live keys swap
├── Bug fixing
├── Pilot user onboarding prep
└── Deploy to production
```

---

## 8. ENVIRONMENT VARIABLES NEEDED

```env
# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxx     # Test key first, live key before launch
PAYSTACK_PUBLIC_KEY=pk_test_xxx

# SMS (Termii)
TERMII_API_KEY=xxx
TERMII_SENDER_ID=AgroCycle

# KYC (Smile ID) — Phase 2
SMILE_ID_API_KEY=xxx
SMILE_ID_PARTNER_ID=xxx

# App
APP_BASE_URL=https://agrocycle.ng    # or Vercel URL for dev
APP_ENV=development                    # development | staging | production

# Base44 (auto-configured)
# BASE44_API_KEY=xxx                  # Already set up

# Monitoring (Sentry)
SENTRY_DSN=xxx                         # Get free DSN from sentry.io

# Analytics (Mixpanel)
MIXPANEL_TOKEN=xxx                     # Get from mixpanel.com
```

---

## SUMMARY

**To start building, you need 3 things:**
1. **Paystack test account** → gives us API keys to build the payment flow
2. **Domain name** → gives us a URL for hosting and Paystack callbacks
3. **Termii account** → gives us SMS for OTP authentication

**Everything else can wait.** The legal docs, partner bank, BVN verification, WhatsApp — all of that comes after we have a working app that can accept deposits and show savings balances.

**The stack in one line:** Next.js + Tailwind frontend on Vercel, Base44 backend (entities + functions + automations), Paystack for payments, Termii for SMS, Sentry for monitoring.

**Timeline:** 6-7 weeks to a functional, production-ready MVP with your pilot association.

---

*This is the complete spec. Once you provide the 3 critical items (Paystack, domain, Termii), we start building immediately.*

**— AgroCycle Engineering**
