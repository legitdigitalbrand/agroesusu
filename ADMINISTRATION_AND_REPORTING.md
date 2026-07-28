# Administration, Reporting & Analytics Module

## Overview

Phase 9 builds the unified administration console and reporting infrastructure. This phase is fundamentally different from all previous phases: it's **read-only**, **cross-cutting**, and serves as a **structural audit** of everything built in Phases 1-8.

**Key principle:** Reporting is READ-ONLY against existing sources of truth. No aggregated/reporting table becomes an alternate source of truth — every figure must be reconstructable from the Ledger or originating module data.

---

## Administration Console — Feature Map by Role

### Super Admin
**Description:** Full platform access. Can manage all configurations, users, and financial operations.

| Feature | Description |
|---|---|
| `dashboard` | Full operational dashboard |
| `audit_log` | All audit logs (general, governance, admin actions) |
| `reporting_all` | All report categories (operational, compliance, risk, audit) |
| `compliance_all` | All compliance reports |
| `savings_products` | Create/edit savings product configs |
| `loan_products` | Create/edit loan product configs |
| `investment_products` | Create/edit investment product configs |
| `group_savings_products` | Create/edit group savings product configs |
| `rbac_management` | Manage roles and permissions |
| `staff_management` | Manage staff users and role assignments |
| `cooperative_management` | Manage cooperatives and governance |
| `system_config` | System-wide configuration |
| `override_financial` | Override financial decisions (with audit trail) |
| `export_all` | Export all report types |

### Operations
**Description:** Manages day-to-day platform operations, monitors transactions, handles escalations.

| Feature | Description |
|---|---|
| `dashboard` | Operational dashboard |
| `audit_log` | General audit log (read-only) |
| `reporting_operational` | Operational reports only |
| `savings_products` | View/edit savings product configs |
| `loan_products` | View/edit loan product configs |
| `investment_products` | View/edit investment product configs |
| `group_savings_products` | View/edit group savings product configs |
| `cooperative_management` | Manage cooperatives |
| `export_operational` | Export operational reports |

### Finance
**Description:** Manages settlements, reconciliations, and financial reporting.

| Feature | Description |
|---|---|
| `dashboard` | Operational dashboard |
| `reporting_financial` | Financial reports |
| `compliance_deposits` | Total deposits held report |
| `compliance_loans` | Total loans outstanding report |
| `reconciliation` | Reconciliation status and resolution |
| `risk_portfolio` | Risk/portfolio views |
| `export_financial` | Export financial reports |

### Compliance
**Description:** Handles KYC reviews, AML monitoring, sanctions screening, regulatory reporting.

| Feature | Description |
|---|---|
| `audit_log` | All audit logs (read-only) |
| `compliance_all` | All compliance reports |
| `kyc_management` | KYC verification management |
| `reporting_compliance` | Compliance reports |
| `audit_governance` | Governance audit log |
| `audit_admin_actions` | Admin action log |
| `export_compliance` | Export compliance reports |

### Loan Officer
**Description:** Reviews and processes loan applications, manages collections, handles customer inquiries.

| Feature | Description |
|---|---|
| `dashboard` | Operational dashboard (loan-relevant sections) |
| `loan_products` | View loan product configs |
| `risk_loan_portfolio` | Loan risk/portfolio views |
| `loan_applications` | Review and process loan applications |
| `collections` | Manage collections and overdue loans |
| `customer_profiles` | View customer profiles |
| `credit_scores` | View credit score distributions |

### Customer Support
**Description:** Handles customer inquiries, account issues, and basic account management.

| Feature | Description |
|---|---|
| `customer_profiles` | View customer profiles |
| `wallet_transactions` | View wallet transactions |
| `savings_accounts_view` | View savings accounts (read-only) |
| `loan_accounts_view` | View loan accounts (read-only) |
| `ticket_management` | Manage support tickets |

### Marketing
**Description:** Manages campaigns, announcements, and promotional content.

| Feature | Description |
|---|---|
| `product_catalog_view` | View product catalog (read-only) |
| `announcements` | Manage announcements |
| `blog_management` | Manage blog content |

---

## Report Catalog

### Operational Reports (real-time)

| Report Key | Name | Source Tables | Roles |
|---|---|---|---|
| `operational_dashboard` | Operational Dashboard | accounts, journal_lines, savings_accounts, loans, investment_accounts, group_savings_accounts | super_admin, operations, finance |
| `operational_savings` | Savings Portfolio | savings_accounts, savings_products, accounts, journal_lines | super_admin, operations, finance |
| `operational_loans` | Loan Portfolio | loans, loan_products, loan_repayment_schedule | super_admin, operations, finance, loan_officer |
| `operational_investments` | Investment Portfolio | investment_accounts, investment_products, pool_performance_records | super_admin, operations, finance |
| `operational_group_savings` | Group Savings & Esusu | group_savings_accounts, group_savings_products, esusu_groups | super_admin, operations |
| `operational_cooperative` | Cooperative Status | cooperatives, cooperative_memberships, governance_audit_log | super_admin, operations |

### Compliance Reports (on-demand, traceable to Ledger)

| Report Key | Name | Source Tables | Roles | Traceability |
|---|---|---|---|---|
| `compliance_total_deposits` | Total Deposits Held | accounts, journal_lines | super_admin, finance, compliance | Sum of ledger balances for 2000, 2001, 2003, 2005 |
| `compliance_loans_outstanding` | Total Loans Outstanding | accounts, journal_lines, loans | super_admin, finance, compliance | Sum of ledger balances for 1002 |
| `compliance_reconciliation` | Reconciliation Status | reconciliation_flags, wallet_transactions | super_admin, finance, compliance | Phase 3 reconciliation flags |
| `compliance_kyc_status` | KYC Verification Status | customers | super_admin, compliance | Customer KYC levels |
| `compliance_audit_trail` | Audit Trail Summary | audit_log, governance_audit_log, admin_action_log | super_admin, compliance | All audit sources |

### Risk Reports (on-demand)

| Report Key | Name | Source Tables | Roles |
|---|---|---|---|
| `risk_loan_default` | Loan Default Rate by Product | loans, loan_products | super_admin, finance, loan_officer |
| `risk_savings_to_loan` | Savings-to-Loan Ratio | accounts, journal_lines | super_admin, finance |
| `risk_investment_performance` | Investment Pool Performance | investment_accounts, investment_products, pool_performance_records | super_admin, finance |
| `risk_credit_scores` | Credit Score Distribution | customer_risk_profiles | super_admin, finance, loan_officer |

### Audit Reports (real-time)

| Report Key | Name | Source Tables | Roles |
|---|---|---|---|
| `audit_financial_transactions` | Financial Transaction Audit | financial_transactions, journal_entries, journal_lines | super_admin, compliance, finance |
| `audit_governance` | Governance Audit Log | governance_audit_log | super_admin, compliance |
| `audit_admin_actions` | Admin Action Log | admin_action_log | super_admin, compliance |

---

## Refresh Cadence Strategy

| Report Category | Cadence | Rationale |
|---|---|---|
| Operational | Real-time | Day-to-day dashboards need current data. Small data volume in sandbox; for production at 1M users, use read replicas or 5-15 min materialized views. |
| Compliance | On-demand | Must be point-in-time accurate and fully traceable. Generated when needed (e.g., for regulatory submission, auditor request). |
| Risk | On-demand | Same rationale as compliance — risk assessments need auditable point-in-time figures. |
| Audit | Real-time | Audit logs must be immediately queryable for incident response. |

**Production scaling note:** For the 1,000,000-user architecture target, operational dashboards would need to switch from real-time queries to periodically refreshed materialized views (5-15 min cadence) to avoid performance degradation. Compliance reports would continue to query the Ledger directly (on-demand) because they need point-in-time accuracy.

---

## Compliance Report Source Traceability

### Total Deposits Held

**Derived from:** Ledger account tree balances (the immutable system of record)

```
Total deposits = get_account_balance(2000.*) +     -- Wallets
                 get_account_balance(2001.*) +     -- Savings
                 get_account_balance(2003.*) +     -- Investments
                 get_account_balance(2005.*)        -- Group Savings
```

Each `get_account_balance(id)` call sums `journal_lines` (immutable double-entry records):
- For liabilities: balance = SUM(credits) - SUM(debits)

**Reconstruction query:**
```sql
SELECT get_account_balance(id) FROM accounts 
WHERE account_code LIKE '2000.%' OR account_code LIKE '2001.%' 
   OR account_code LIKE '2003.%' OR account_code LIKE '2005.%';
```

### Total Loans Outstanding

**Derived from:** Ledger asset account tree 1002 (Loan Receivables)

```
Total loans outstanding = get_account_balance(1002.*)
```

For assets: balance = SUM(debits) - SUM(credits)
- Disbursing a loan: D 1002.{loan}, C 2002.{settlement} → increases 1002 balance
- Repaying a loan: D 2002.{settlement}, C 1002.{loan} → decreases 1002 balance

### Reconciliation Status

**Derived from:** `reconciliation_flags` table (Phase 3)

Each flag is created by the daily reconciliation cron job comparing `wallet_transactions` against Safe Haven settlement data. Flags have: `status` (matched/unmatched/flagged/resolved/pending), `wallet_transaction_id`, and resolution metadata.

### KYC Status

**Derived from:** `customers` table — `kyc_level` and `kyc_status` fields

KYC levels: 0=unverified, 1=basic, 2=standard (BVN+ID), 3=enhanced (full verification)

---

## Investment Reporting — Guaranteed vs. Variable Distinction

**CRITICAL:** Guaranteed and variable_pool returns are NEVER blended into a single misleading aggregate.

The `getInvestmentPoolPerformance()` report returns three separate sections:

1. **guaranteed**: Products with `return_guarantee = 'guaranteed'` — AUM and returns paid (formula-based)
2. **variable_pool**: Products with `return_guarantee = 'variable_pool'` — AUM, pool performance records count, total returns, distributed amount (performance-based)
3. **expected**: Products with `return_guarantee = 'expected'` — AUM and returns paid (formula-based, not contractual)

Each section has a clear label. The report includes a warning: "Guaranteed and variable_pool returns are shown SEPARATELY. Do NOT sum them into one aggregate without clear labeling."

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/admin/dashboard` | GET | Staff | Full operational dashboard + admin overview |
| `/api/admin/audit` | GET | Staff | Audit log viewer (filterable, supports summary mode) |
| `/api/admin/compliance` | GET | Staff | Compliance reports (deposits, loans, reconciliation, KYC) |
| `/api/admin/risk` | GET | Staff | Risk/portfolio views (loan default, savings-to-loan, investment performance) |
| `/api/admin/reports` | GET | Staff | List available reports for the user's role |
| `/api/admin/reports/[reportKey]` | GET | Staff | Generate/export a specific report (supports format=csv\|json) |

---

## Database Tables (Phase 9 — Migration 00032)

| Table | Purpose | Is Source of Truth? |
|---|---|---|
| `reporting_snapshots` | Daily metrics for trend analysis | NO — derived, rebuildable |
| `report_generations` | Audit trail of report exports | YES (audit trail) |
| `report_definitions` | Catalog of available reports | YES (config) |
| `admin_action_log` | Admin console action audit trail | YES (audit trail) |

**54 tables total** across all 9 phases.
