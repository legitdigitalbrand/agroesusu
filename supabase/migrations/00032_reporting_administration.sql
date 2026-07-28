-- ============================================================================
-- Migration 00032: Reporting & Administration Infrastructure
-- 
-- Phase 9: Administration, Reporting & Analytics
-- 
-- This migration creates:
--   1. reporting_snapshots — daily snapshot of key metrics for trend analysis
--   2. report_generations — audit trail of report exports (who generated what, when)
--   3. report_definitions — catalog of available reports
--   4. admin_action_log — audit trail for admin console actions (config changes, RBAC, overrides)
-- 
-- Key principle: Reporting is READ-ONLY against existing sources of truth.
-- These tables store DERIVED data (snapshots) and AUDIT TRAIL (report generations,
-- admin actions) — they are NOT a new source of truth.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Reporting Snapshots — daily metrics for trend analysis
-- 
-- These are DERIVED from the Ledger and module data. They can be rebuilt
-- at any time by re-running the snapshot job. They are NOT a source of truth.
-- ============================================================================
CREATE TABLE public.reporting_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   date NOT NULL,
  category        text NOT NULL,  -- 'portfolio', 'loans', 'savings', 'investments', 'compliance', 'cooperative'
  metrics         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(snapshot_date, category)
);

CREATE INDEX idx_rs_date ON public.reporting_snapshots(snapshot_date);
CREATE INDEX idx_rs_category ON public.reporting_snapshots(category);

-- ============================================================================
-- Report Generations — audit trail of report exports
-- 
-- Every time a report is generated/exported, a record is created here.
-- This answers "who generated what report, when, with what parameters."
-- ============================================================================
CREATE TABLE public.report_generations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type     text NOT NULL,     -- e.g., 'compliance_deposits', 'risk_loan_portfolio'
  report_name     text NOT NULL,     -- human-readable name
  generated_by    uuid REFERENCES auth.users(id),
  generated_at    timestamptz NOT NULL DEFAULT now(),
  parameters      jsonb,             -- filter parameters used
  file_format     text,              -- 'csv', 'json', 'pdf'
  file_url        text,              -- if exported to file storage
  row_count       integer,
  metadata        jsonb,
  
  CONSTRAINT chk_rg_format CHECK (file_format IS NULL OR file_format IN ('csv', 'json', 'pdf', 'xlsx'))
);

CREATE INDEX idx_rg_type ON public.report_generations(report_type);
CREATE INDEX idx_rg_generated_by ON public.report_generations(generated_by);
CREATE INDEX idx_rg_generated_at ON public.report_generations(generated_at);

-- ============================================================================
-- Report Definitions — catalog of available reports
-- 
-- Admin-configurable report catalog. Each report has a type, category,
-- description, and the role(s) that can access it.
-- ============================================================================
CREATE TABLE public.report_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key       text NOT NULL UNIQUE,    -- e.g., 'compliance_total_deposits'
  report_name      text NOT NULL,
  report_category  text NOT NULL,           -- 'operational', 'compliance', 'risk', 'audit'
  description      text,
  allowed_roles     text[] NOT NULL DEFAULT '{}',  -- role names that can access
  is_active         boolean NOT NULL DEFAULT true,
  refresh_cadence   text NOT NULL DEFAULT 'on_demand',  -- 'real_time', 'daily', 'on_demand'
  source_tables     text[] NOT NULL DEFAULT '{}',     -- tables/views this report reads from
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rd_category ON public.report_definitions(report_category);
CREATE INDEX idx_rd_active ON public.report_definitions(is_active) WHERE is_active = true;

CREATE TRIGGER trg_rd_updated_at
  BEFORE UPDATE ON public.report_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Admin Action Log — audit trail for admin console actions
-- 
-- Every admin console action (config change, RBAC change, override) is logged
-- here with the same rigor as customer-facing financial actions.
-- ============================================================================
CREATE TABLE public.admin_action_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   uuid NOT NULL REFERENCES auth.users(id),
  admin_role       text NOT NULL,
  action          text NOT NULL,          -- e.g., 'update_product_config', 'assign_role', 'override_decision'
  action_category text NOT NULL,         -- 'configuration', 'rbac', 'financial_override', 'compliance', 'product_management'
  entity_type     text,                  -- e.g., 'savings_product', 'loan_product', 'staff_user'
  entity_id       uuid,
  before_state     jsonb,
  after_state      jsonb,
  result          text NOT NULL DEFAULT 'success',  -- 'success', 'failed', 'denied'
  error_message   text,
  source_ip       inet,
  user_agent      text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aal_admin_user ON public.admin_action_log(admin_user_id);
CREATE INDEX idx_aal_action ON public.admin_action_log(action);
CREATE INDEX idx_aal_category ON public.admin_action_log(action_category);
CREATE INDEX idx_aal_entity ON public.admin_action_log(entity_type, entity_id);
CREATE INDEX idx_aal_created_at ON public.admin_action_log(created_at);

-- ============================================================================
-- Seed Report Definitions
-- ============================================================================
INSERT INTO public.report_definitions (report_key, report_name, report_category, description, allowed_roles, refresh_cadence, source_tables) VALUES
-- Operational
('operational_dashboard', 'Operational Dashboard', 'operational', 'Real-time platform health: active volumes, disbursements, repayments, overdue rates', '{super_admin,operations,finance}', 'real_time', '{accounts,journal_lines,savings_accounts,loans,investment_accounts,group_savings_accounts}'),
('operational_savings', 'Savings Portfolio', 'operational', 'Active savings accounts, total balances, interest paid by product', '{super_admin,operations,finance}', 'real_time', '{savings_accounts,savings_products,accounts,journal_lines}'),
('operational_loans', 'Loan Portfolio', 'operational', 'Active loans, disbursements, repayments, overdue rates by product', '{super_admin,operations,finance,loan_officer}', 'real_time', '{loans,loan_products,loan_repayment_schedule}'),
('operational_investments', 'Investment Portfolio', 'operational', 'Active investments, AUM, returns by product (separated by guarantee type)', '{super_admin,operations,finance}', 'real_time', '{investment_accounts,investment_products,pool_performance_records}'),
('operational_group_savings', 'Group Savings & Esusu', 'operational', 'Active group savings accounts, Esusu cycles, contribution status', '{super_admin,operations}', 'real_time', '{group_savings_accounts,group_savings_products,esusu_groups}'),
('operational_cooperative', 'Cooperative Status', 'operational', 'Membership growth, governance activity, resolution status', '{super_admin,operations}', 'real_time', '{cooperatives,cooperative_memberships,governance_audit_log}'),

-- Compliance
('compliance_total_deposits', 'Total Deposits Held', 'compliance', 'Total customer deposits (wallets + savings + investments + group savings) — traceable to Ledger', '{super_admin,finance,compliance}', 'on_demand', '{accounts,journal_lines}'),
('compliance_loans_outstanding', 'Total Loans Outstanding', 'compliance', 'Total loan receivables — traceable to Ledger asset accounts', '{super_admin,finance,compliance}', 'on_demand', '{accounts,journal_lines,loans}'),
('compliance_reconciliation', 'Reconciliation Status', 'compliance', 'Wallet reconciliation status summary — matched, unmatched, flagged', '{super_admin,finance,compliance}', 'on_demand', '{reconciliation_flags,wallet_transactions}'),
('compliance_kyc_status', 'KYC Verification Status', 'compliance', 'Customer KYC verification levels and pending reviews', '{super_admin,compliance}', 'on_demand', '{customers}'),
('compliance_audit_trail', 'Audit Trail Summary', 'compliance', 'Summary of audit log entries by actor, module, action type', '{super_admin,compliance}', 'on_demand', '{audit_log,governance_audit_log,admin_action_log}'),

-- Risk
('risk_loan_default', 'Loan Default Rate by Product', 'risk', 'Default rate, overdue analysis, non-performing loan ratio by product', '{super_admin,finance,loan_officer}', 'on_demand', '{loans,loan_products}'),
('risk_savings_to_loan', 'Savings-to-Loan Ratio', 'risk', 'Portfolio-level savings-to-loan ratio health indicator', '{super_admin,finance}', 'on_demand', '{accounts,journal_lines}'),
('risk_investment_performance', 'Investment Pool Performance', 'risk', 'Pool performance summary — guaranteed vs. variable returns shown SEPARATELY', '{super_admin,finance}', 'on_demand', '{investment_accounts,investment_products,pool_performance_records}'),
('risk_credit_scores', 'Customer Credit Score Distribution', 'risk', 'Distribution of internal credit scores across customer base', '{super_admin,finance,loan_officer}', 'on_demand', '{customer_risk_profiles}'),

-- Audit
('audit_financial_transactions', 'Financial Transaction Audit', 'audit', 'Queryable view over all financial transactions (Orchestrator state machine)', '{super_admin,compliance,finance}', 'real_time', '{financial_transactions,journal_entries,journal_lines}'),
('audit_governance', 'Governance Audit Log', 'audit', 'Cooperative governance actions (elections, resolutions, meetings)', '{super_admin,compliance}', 'real_time', '{governance_audit_log}'),
('audit_admin_actions', 'Admin Action Log', 'audit', 'Admin console actions (config changes, RBAC changes, overrides)', '{super_admin,compliance}', 'real_time', '{admin_action_log}');

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.reporting_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

-- Reporting snapshots: staff read, service role write
CREATE POLICY rs_read_staff
  ON public.reporting_snapshots FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY rs_write_service
  ON public.reporting_snapshots FOR ALL TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

-- Report generations: staff read their own + super_admin sees all
CREATE POLICY rg_read_self
  ON public.report_generations FOR SELECT TO authenticated
  USING (generated_by = auth.uid() OR public.has_role('super_admin'));

CREATE POLICY rg_write_self
  ON public.report_generations FOR INSERT TO authenticated
  WITH CHECK (generated_by = auth.uid() OR public.has_role('super_admin'));

-- Report definitions: staff read
CREATE POLICY rd_read_staff
  ON public.report_definitions FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role('super_admin'));

CREATE POLICY rd_write_admin
  ON public.report_definitions FOR ALL TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

-- Admin action log: super_admin and compliance read; service role write
CREATE POLICY aal_read_admin
  ON public.admin_action_log FOR SELECT TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('compliance'));

CREATE POLICY aal_write_service
  ON public.admin_action_log FOR INSERT TO authenticated
  WITH CHECK (true);  -- Written by service role (cron, admin API)

COMMIT;
