// ============================================================================
// Investment Module — Type Definitions
// ============================================================================

export type InvestmentType = 'fixed_income' | 'unitized' | 'cooperative_fund' | 'money_market' | 'agricultural_pool';
export type InvestmentStatus = 'pending' | 'active' | 'matured' | 'redeemed' | 'closed' | 'suspended';
export type ProductStatus = 'draft' | 'active' | 'suspended' | 'retired';
export type InvestmentTxType = 'subscription' | 'redemption' | 'returns_payout' | 'returns_reinvest' | 'management_fee' | 'early_exit_fee' | 'top_up' | 'principal_return';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'very_high';

export interface InvestmentProduct {
  id: string;
  product_code: string;
  product_name: string;
  investment_type: InvestmentType;
  description: string | null;
  expected_return_rate: number;
  return_type: string;
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
  amount?: number;        // NULL = full redemption
  is_partial: boolean;
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
