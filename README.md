# Agroesusu — Grow Your Farm, Grow Your Money

Agricultural fintech platform built for Nigerian farmers. Crop/livestock/equipment loans, agricultural esusu (rotating savings), farm-input bill payments, and farmer-specific credit scoring.

**⚠️ Legal:** Agroesusu operates via a licensed partner bank. Agroesusu is not a bank — banking services (deposits, loans, transfers) are provided by our licensed banking partner. Deposits are insured.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend/DB/Auth:** Supabase (Postgres, RLS, Auth, Storage, Edge Functions)
- **Banking-as-a-Service:** Safe Haven API (BVN, DVA, transfers, webhooks)
- **Hosting:** Vercel

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SAFE_HAVEN_BASE_URL=
SAFE_HAVEN_API_KEY=
SAFE_HAVEN_SECRET_KEY=
SAFE_HAVEN_WEBHOOK_SECRET=
SAFE_HAVEN_ENV=sandbox
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Safe Haven Integration Status

| Feature | Status | Notes |
|---------|--------|-------|
| BVN Verification | ✅ Wired | `verifyBvn()` in `lib/safe-haven/client.ts` |
| Dedicated Virtual Accounts | ✅ Wired | `createDVA()` — one per user |
| Transaction History | ✅ Wired | `getTransactionHistory()` |
| Transfers | ✅ Wired | `initiateTransfer()` / `getTransferStatus()` |
| Bill Payments | ⚠️ Stub | If Safe Haven lacks VAS endpoints, bill pay uses UI-only mock. Confirm with Safe Haven docs. |
| Webhook Signature | ✅ Wired | `verifyWebhookSignature()` — HMAC-SHA256 |
| Credit Bureau Pull | ❌ Proxy | No bureau endpoint. Internal credit scoring engine in `lib/credit-scoring/engine.ts` scores based on DVA cashflow, repayment history, farm income, KYC completeness. NOT an official bureau score. |

### Sandbox vs Production

Switch by setting `SAFE_HAVEN_ENV=sandbox` or `SAFE_HAVEN_ENV=production`. If `SAFE_HAVEN_API_KEY` is not set, the mock client (`lib/safe-haven/mock.ts`) is used automatically for development.

## Database Setup

Run the migration:

```bash
supabase db push
# or apply supabase/migrations/00001_initial_schema.sql manually
```

All tables have Row Level Security enabled — users only see their own rows. Admins bypass via service role.

## Local Development

```bash
npm install
npm run dev
```

## Architecture

```
src/
├── app/
│   ├── (marketing)/        # Public marketing site (Renmoney-style)
│   │   ├── page.tsx         # Homepage with hero, trust badges, feature tabs
│   │   ├── loans/           # Loan product page + calculator
│   │   ├── savings/         # Esusu/fixed-deposit explainer
│   │   ├── features/        # Account, Bill Pay, Referrals, Cards
│   │   ├── about/ careers/ blog/ faqs/ contact/
│   │   └── layout.tsx       # Header + Footer
│   ├── (app)/              # Authenticated app (web.renmoney.com equivalent)
│   │   ├── login/ signup/ onboarding/
│   │   ├── dashboard/       # Balance, loan status, quick actions, transactions
│   │   ├── loans/           # List, apply (multi-step wizard), detail + schedule
│   │   ├── savings/         # Esusu circles + fixed deposits
│   │   ├── wallet/          # DVA balance, fund/withdraw, transaction history
│   │   ├── pay/             # Bill pay & farm-input marketplace
│   │   ├── transfers/       # Send to any Nigerian bank
│   │   ├── cards/ referrals/ profile/ notifications/ support/
│   │   └── layout.tsx       # Sidebar + Topbar (auth-guarded)
├── components/
│   ├── marketing/          # Header, Footer, FeatureSwitcher, Testimonials
│   └── app/                # Sidebar, Topbar, EmptyState
├── lib/
│   ├── safe-haven/         # Client, mock, factory
│   ├── credit-scoring/     # Internal scoring engine (proxy, not bureau)
│   ├── supabase/           # Browser, server, service-role clients
│   └── types/              # TypeScript types for all entities
└── middleware.ts           # Auth guard for (app) routes
```

## License

Proprietary. © 2026 Agroesusu. All rights reserved.
