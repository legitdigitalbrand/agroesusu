// ============================================================================
// Investment Module — Type Definitions
// 
// UPDATED IN PHASE 8: Added return_guarantee distinction, pool performance,
// proportional distribution, and rollover types.
// ============================================================================

export type InvestmentType = 'fixed_income' | 'unitized' | 'cooperative_fund' | 'money_market' | 'agricultural_pool';
export type InvestmentStatus = 'pending' | 'active' | 'matured' | 'redeemed' | 'closed' | 'suspended';
export type ProductStatus = 'draft' | 'active' | 'suspended' | 'retired';
export type InvestmentTxType = 'subscription' | 'redemption' | 'returns_payout' | 'returns_reinvest' | 'management_fee' | 'early_exit_fee' | 'top_up' | 'principal_return';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'very_high';

/**
 * Return Guarantee Type — honestly distinguishes return structures.
 * 
 * - 'guanteed': Rate is contractually guaranteed (e.g., Fixed Income Fund)
 * - 'expected': Target rate, highly likely but not contractual (e.g., Money Market)
 * - 'variable_pool': Returns depend on actual pool performance (e.g., Agricultural Pool, Cooperative Growth Fund)
 * 
 * Products with 'variable_pool' must NEVER show expected_return_rate as guaranteed.
 */
export type ReturnGuaranteeType = 'guaranteed' | 'expected' | 'variable_pool';

export interface InvestmentProduct {
  id: string;
  product_code: string;
  product_name: string;
  investment_type: InvestmentType;
  description: string | null;
  expected_return_rate: number;
  return_type: string;
  return_guarantee: ReturnGuaranteeType;
  min_investment: number;
  max_investment: number | null;
  min_tenure_days: number;
  max_tenure_days: number | null;
  nav_per_unit: number | null;
  total_units_available: number | null;
  units_issued: number;
  risk_level: RiskLevel;
  risk_score: number;
  management_fee_rate: number;
  early_exit_fee_rate: number;
  early_exit_lock_days: number;
  allows_early_redemption: boolean;
  allows_partial_redemption: boolean;
  allows_top_up: boolean;
  auto_reinvest: boolean;
  cooperative_required: boolean;
  risk_disclosure_text: string;
  risk_disclosure_version: string;
  is_active: boolean;
  status: ProductStatus;
  config: Record<string, unknown>;
}

export interface InvestmentAccount {
  id: string;
  account_number: string;
  product_id: string;
  customer_id: string;
  principal_amount: number;
  current_value: number;
  units_held: number | null;
  purchase_nav: number | null;
  current_nav: number | null;
  tenure_days: number | null;
  start_date: string | null;
  maturity_date: string | null;
  last_valuation_date: string | null;
  returns_earned: number;
  returns_paid_out: number;
  status: InvestmentStatus;
  terms_snapshot: Record<string, unknown>;
  risk_disclosure_accepted: boolean;
  risk_disclosure_accepted_at: string | null;
  risk_disclosure_version: string;
  metadata: Record<string, unknown>;
  rolled_over_from: string | null;
  rolled_over_at: string | null;
  created_at: string;
}

export interface InvestmentTransaction {
  id: string;
  investment_account_id: string;
  customer_id: string;
  transaction_type: InvestmentTxType;
  amount: number;
  units: number | null;
  nav_at_transaction: number | null;
  financial_transaction_id: string | null;
  source_reference: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RiskDisclosureAcceptance {
  id: string;
  investment_account_id: string | null;
  customer_id: string;
  product_id: string;
  disclosure_text: string;
  disclosure_version: string;
  product_name: string;
  risk_level: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

// ============================================================================
// Pool Performance & Distribution Types
// ============================================================================

/**
 * Pool Performance Record — admin-entered performance data for variable_pool products.
 * 
 * This is the INPUT MECHANISM for pool-based returns. It is NOT a fabricated
 * performance model. Pool performance is manually entered by admin staff based
 * on real-world outcomes (crop sales, cooperative profit distributions, etc.).
 * 
 * Every entry is fully auditable: who entered it, when, based on what source.
 */
export interface PoolPerformanceRecord {
  id: string;
  product_id: string;
  performance_date: string;
  period_start: string;
  period_end: string;
  total_pool_value: number;
  total_returns: number;
  return_rate: number;
  expense_ratio: number;
  net_distributable: number;
  distributed_amount: number;
  is_distributed: boolean;
  distributed_at: string | null;
  entered_by: string;
  entered_at: string;
  source_description: string;
  supporting_notes: string | null;
  source_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoolDistribution {
  id: string;
  performance_record_id: string;
  investment_account_id: string;
  customer_id: string;
  pool_share: number;
  distributed_amount: number;
  distribution_type: 'payout' | 'reinvest';
  financial_transaction_id: string | null;
  distributed_at: string;
  distributed_by: string | null;
  created_at: string;
}

/**
 * Admin-entered pool performance data.
 * This is what an admin staff member submits when recording pool performance.
 */
export interface PoolPerformanceEntry {
  product_id: string;
  performance_date: string;
  period_start: string;
  period_end: string;
  total_pool_value: number;
  total_returns: number;
  return_rate: number;
  expense_ratio?: number;
  source_description: string;
  supporting_notes?: string;
  source_reference?: string;
  entered_by: string;  // auth.users ID of the admin
}

export interface DistributionResult {
  success: boolean;
  performance_record_id: string;
  total_distributed: number;
  contributor_count: number;
  distributions: PoolDistribution[];
  error?: string;
}

// ============================================================================
// Request/Result Types
// ============================================================================

export interface SubscriptionRequest {
  product_id: string;
  customer_id: string;
  wallet_id: string;
  amount: number;
  tenure_days?: number;
  accept_risk_disclosure: boolean;
  ip_address?: string;
  user_agent?: string;
}

export interface RedemptionRequest {
  investment_account_id: string;
  wallet_id: string;
  amount?: number;
  is_partial: boolean;
}

export interface RolloverRequest {
  investment_account_id: string;
  wallet_id: string;
  new_tenure_days?: number;
}

export interface RolloverResult {
  success: boolean;
  new_account_id?: string;
  transaction_reference?: string;
  error?: string;
}

export interface SubscriptionResult {
  success: boolean;
  account?: InvestmentAccount;
  transaction_reference?: string;
  error?: string;
}

export interface RedemptionResult {
  success: boolean;
  transaction_reference?: string;
  redeemed_amount?: number;
  error?: string;
}

export interface ReturnsResult {
  success: boolean;
  transaction_reference?: string;
  returns_amount?: number;
  reinvested?: boolean;
  error?: string;
}
