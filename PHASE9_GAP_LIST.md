# Phase 9 Gap List — Structural Audit of Phases 1-8

This document was produced as part of Phase 9 (Administration, Reporting & Analytics), which serves as a structural audit of the previous eight phases. Each gap is a real finding, not just a nitpick — they represent places where earlier phases' shortcuts or ambiguities didn't get fully resolved.

---

## 1. Documentation Gaps

### 1.1. Missing Volume 05 Data Models
Volume 05 (Data Models) was only partially received. The Wallet, Ledger, and FTO domain models were provided, but Savings, Loans, Cooperative, Investment, and Administration data models were never delivered. The actual database schema was designed from Volume 04's domain architecture descriptions, not from formal data models.

**Impact:** The schema is correct and functional, but there's no formal data model document to cross-reference against. If the CTO has the remaining Volume 05 parts, they should be reviewed against the actual schema for any missed fields or relationships.

### 1.2. No Formal API Contract Documentation
Each phase built API routes, but there's no unified API contract document. The routes are documented in individual phase markdown files, but there's no single source of truth for the API surface.

**Impact:** Frontend developers (or future API consumers) have to scan multiple markdown files to understand the full API. A consolidated API reference (OpenAPI/Swagger or similar) would be valuable.

### 1.3. SETUP.md is Minimal
The SETUP.md file exists but doesn't cover the full local development setup process — env vars, Supabase project creation, seed data, etc.

---

## 2. Code Stubs / Thin Modules

### 2.1. Thin Module Stubs (9 modules with only 1 file each)
The following modules were created as placeholder stubs during early phases but never fully built:
- `src/modules/audit/` — 1 file (audit logging is handled by the database-level audit_log table + Phase 9's audit viewer, but there's no dedicated audit module with query/verification utilities)
- `src/modules/communications/` — 1 file (notifications/communications were referenced in Volume 02 but never built)
- `src/modules/compliance/` — 1 file (compliance/KYC/AML were lighter-touch in earlier phases; Phase 9 added reporting, but the compliance decisioning/monitoring module is still a stub)
- `src/modules/configuration/` — 1 file (configuration engine was referenced in standing instructions but admin config is handled per-module)
- `src/modules/group-savings/` — 1 file (group savings logic lives in `src/modules/cooperative/group-savings.ts` instead)
- `src/modules/identity/` — 1 file (identity/auth is handled by Supabase Auth + RBAC tables, but there's no dedicated identity module)
- `src/modules/membership/` — 1 file (membership logic lives in `src/modules/cooperative/membership.ts` instead)
- `src/modules/risk/` — 1 file (risk assessment lives in `src/modules/loans/risk.ts` and `customer_risk_profiles` table, but there's no unified risk module)

**Impact:** These are architectural placeholders. The functionality exists in other locations (cooperative module, loans module, etc.) — these stub modules should either be removed to avoid confusion or properly built out.

### 2.2. Cooperative Participation Stub Reference
`src/modules/loans/eligibility.ts` line 91 references a "stub" for cooperative participation. This was wired in Phase 7 (the `cooperative_participation_signals` table is now used), but the comment still says "stub."

**Impact:** Cosmetic — the code is correct, the comment is outdated.

---

## 3. Unresolved Decisions

### 3.1. Cash vs. Accrual Basis for Investment Returns (Open from Phase 8)
Should investment returns be reported on cash basis (when paid) or accrual basis (when earned)? Currently, returns are posted when calculated/distributed (effectively cash basis for guaranteed, performance-basis for variable_pool). The reporting module doesn't distinguish — it just reports what was posted.

### 3.2. NAV Intra-day vs. Daily (Open from Phase 8)
The `investment_nav_history` table supports daily NAV entries. Intra-day valuations are not supported. If real-time NAV is needed for unitized products, this would require a different approach.

### 3.3. Management Fees: Separate Transactions vs. Netted (Open from Phase 8)
Currently, management fees are netted against returns (gross returns - management fee = net returns, and only net returns are posted). If fees need to be posted as separate transactions (for revenue recognition), the returns engine would need modification.

### 3.4. Esusu Missed-Contribution Handling (Open from Phase 7)
The `missed_contribution_action` field on `esusu_groups` supports `skip_turn` and `exclude_member` modes, but the actual enforcement logic for these modes was not fully implemented. The cron job processes payouts but doesn't handle missed-contribution scenarios.

### 3.5. Group Savings Interest Accrual (Open from Phase 7)
Group savings accounts don't have interest accrual. Whether they should use the savings interest cron or have a separate mechanism was never decided.

### 3.6. Reconciliation Flag Resolution Workflow
`reconciliation_flags` table has a `resolution` field and `resolved_by` field, but there's no API endpoint for staff to resolve flags. The daily reconciliation cron creates flags, but there's no UI/API for an operations staff member to review and resolve them.

---

## 4. Inconsistencies

### 4.1. Account Balance Calculation
The `get_account_balance` SQL function calculates balance from journal_lines. For liabilities, it returns credits - debits. For assets, it returns debits - credits. However, the `accounts` table doesn't have a `balance` column — all balances are derived. This is correct by design, but some module code (e.g., `investment_accounts.current_value`) stores a denormalized "current_value" that may drift from the ledger balance if bugs occur.

**Impact:** The `current_value` on investment accounts is an operational convenience. The TRUE financial balance is in the Ledger. Phase 9's compliance reports correctly use the Ledger, not the denormalized field. But this should be documented as a known denormalization.

### 4.2. Product Code Naming Conventions
- Savings products: `FLEX`, `FD-90`, `ESUSU-BASIC` (uppercase with hyphens)
- Loan products: `SAL`, `AGR` (3-letter uppercase)
- Investment products: `INV-0001`, `INV-0002` (numbered with prefix)
- Group savings products: `EQUAL-SHARE`, `COMMON-POOL` (uppercase with hyphens)

**Impact:** Cosmetic — inconsistent but functional. A unified naming convention would be cleaner.

### 4.3. Financial Transaction Type Naming
The Orchestrator's `FinancialTransactionType` uses `savings_contribution` (not `savings_deposit`) and `savings_withdrawal`, but the savings module's API endpoints use `/deposit` and `/withdraw`. This naming mismatch is documented but could cause confusion.

---

## 5. Missing Features

### 5.1. No Staff User Management API
The `staff_users` and `staff_role_assignments` tables exist (Phase 1), but there's no API for creating staff users, assigning roles, or managing their access. Phase 9 added the admin feature map, but the actual CRUD endpoints for staff management are missing.

### 5.2. No Reconciliation Resolution API
As noted in 3.6 above — flags can be created but not resolved via API.

### 5.3. No Scheduled Report Generation
Reports are generated on-demand. There's no mechanism to schedule report generation (e.g., "email me the compliance report every Monday"). The `report_definitions` table has a `refresh_cadence` field, but the scheduling mechanism is not built.

### 5.4. No Report Emailing/Distribution
Generated reports can be exported as CSV/JSON, but there's no mechanism to email them to stakeholders or distribute them via other channels.

### 5.5. No Notifications/Communications Module
The `communications` module is a stub. Push notifications, SMS, and email notifications were referenced in Volume 02 but never built. All cron jobs process silently — there's no way to alert staff when something goes wrong.

### 5.6. No Full AML/Sanctions Screening
KYC levels are tracked in the `customers` table, but there's no active AML monitoring, sanctions screening, or transaction monitoring beyond the basic KYC status. This was acknowledged as "lighter-touch" in earlier phases.

---

## 6. Technical Debt

### 6.1. Pre-existing TypeScript Warnings
Several pre-existing TypeScript warnings (unused variables in auth/marketing pages):
- `src/app/(auth)/login/page.tsx(48,15)`: 'data' is declared but never read
- `src/app/(auth)/onboarding/page.tsx(14,3)`: 'MapPin' is declared but never read
- `src/app/(marketing)/about/page.tsx(3,25)`: 'Award' is declared but never read

**Impact:** Cosmetic — no functional impact, but should be cleaned up.

### 6.2. N+1 Query Patterns
Several reporting queries use N+1 patterns (looping over accounts and calling `get_account_balance` for each one). For the sandbox this is fine, but at scale (1M users), these would need to be rewritten as batch queries or use materialized views.

**Impact:** Performance — not a problem now, but will be at scale.

### 6.3. No Database Indexes on Some Foreign Keys
Some foreign key columns don't have explicit indexes. PostgreSQL doesn't automatically create indexes for foreign keys (only for primary keys and unique constraints).

**Impact:** Performance — queries joining on these columns would do sequential scans.

### 6.4. No Rate Limiting on API Routes
API routes don't have rate limiting. In production, this would be needed to prevent abuse.

### 6.5. No Integration Tests
The platform has no integration tests. Each phase was verified by running TypeScript checks and manual SQL queries, but there's no automated test suite.

---

## Summary

The platform is architecturally sound — the Orchestrator/Ledger contract is clean, all financial transactions flow through it, and the double-entry accounting model is correctly enforced at the database level. The gaps listed above are mostly about completeness (stub modules, missing CRUD endpoints) and scale readiness (N+1 queries, rate limiting, tests) rather than architectural correctness.

The most important gaps for a CTO to prioritize:
1. **Staff management API** (needed for real admin operations)
2. **Reconciliation resolution workflow** (needed for day-to-day operations)
3. **Communications/notifications module** (needed for operational alerts)
4. **Integration tests** (needed before production deployment)
5. **Scale optimization** (N+1 → batch queries, materialized views)
