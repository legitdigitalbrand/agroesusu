// ============================================================================
// Reporting Types
// ============================================================================

export type ReportCategory = 'operational' | 'compliance' | 'risk' | 'audit';
export type RefreshCadence = 'real_time' | 'daily' | 'on_demand';

export interface ReportDefinition {
  id: string;
  report_key: string;
  report_name: string;
  report_category: ReportCategory;
  description: string | null;
  allowed_roles: string[];
  is_active: boolean;
  refresh_cadence: RefreshCadence;
  source_tables: string[];
}

export interface PortfolioSummary {
  total_wallet_balances: number;
  total_savings: number;
  total_investments: number;
  total_group_savings: number;
  total_loans_outstanding: number;
  total_customer_deposits: number;
  total_interest_expense: number;
  total_interest_revenue: number;
  total_fee_revenue: number;
  snapshot_date: string;
}

export interface LoanPortfolioReport {
  total_active_loans: number;
  total_disbursed: number;
  total_repaid: number;
  total_outstanding: number;
  total_overdue: number;
  overdue_count: number;
  default_count: number;
  default_rate: number;
  by_product: ProductBreakdown[];
}

export interface ProductBreakdown {
  product_code: string;
  product_name: string;
  active_count: number;
  total_amount: number;
  overdue_amount: number;
  overdue_count: number;
}

export interface SavingsPortfolioReport {
  total_active_accounts: number;
  total_balance: number;
  total_interest_paid: number;
  by_product: ProductBreakdown[];
}

export interface InvestmentPortfolioReport {
  total_active_accounts: number;
  total_aum: number;
  guaranteed_aum: number;
  variable_pool_aum: number;
  expected_aum: number;
  guaranteed_returns_paid: number;
  variable_pool_returns_distributed: number;
  by_product: InvestmentProductBreakdown[];
}

export interface InvestmentProductBreakdown extends ProductBreakdown {
  return_guarantee: string;
  expected_return_rate: number;
  returns_paid: number;
}

export interface ComplianceDepositsReport {
  total_wallets: number;
  total_wallet_balance: number;
  total_savings_accounts: number;
  total_savings_balance: number;
  total_investment_accounts: number;
  total_investment_balance: number;
  total_group_savings: number;
  total_group_savings_balance: number;
  grand_total_deposits: number;
  // Ledger traceability
  ledger_account_2000_balance: number;
  ledger_account_2001_balance: number;
  ledger_account_2003_balance: number;
  ledger_account_2005_balance: number;
  ledger_total_liabilities: number;
}

export interface ComplianceLoansReport {
  total_active_loans: number;
  total_disbursed: number;
  total_outstanding: number;
  total_overdue: number;
  // Ledger traceability
  ledger_account_1002_balance: number;
  ledger_total_loan_assets: number;
}

export interface ReconciliationReport {
  total_transactions: number;
  matched: number;
  unmatched: number;
  flagged: number;
  resolved: number;
  pending: number;
}

export interface KYCStatusReport {
  total_customers: number;
  level_1: number;
  level_2: number;
  level_3: number;
  unverified: number;
  pending_review: number;
}

export interface AuditLogQuery {
  actor_id?: string;
  actor_type?: string;
  module?: string;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  result?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  action_category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  result: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogSummary {
  total_entries: number;
  by_actor: { actor: string; count: number }[];
  by_module: { module: string; count: number }[];
  by_action: { action: string; count: number }[];
  by_result: { result: string; count: number }[];
  date_range: { earliest: string; latest: string };
}

export interface RiskReport {
  default_rate_by_product: ProductBreakdown[];
  savings_to_loan_ratio: number;
  total_savings: number;
  total_loans: number;
  credit_score_distribution: {
    range_300_579: number;
    range_580_669: number;
    range_670_739: number;
    range_740_799: number;
    range_800_850: number;
  };
}

export interface OperationalDashboard {
  portfolio: PortfolioSummary;
  loans: LoanPortfolioReport;
  savings: SavingsPortfolioReport;
  investments: InvestmentPortfolioReport;
  group_savings: {
    active_groups: number;
    total_group_balance: number;
    active_esusu_cycles: number;
  };
  cooperative: {
    total_cooperatives: number;
    total_members: number;
    pending_resolutions: number;
  };
  generated_at: string;
}
