// ============================================================================
// Savings Engine — Type Definitions
// ============================================================================

export type SavingsProductType = 'flexible' | 'fixed_deposit' | 'target' | 'business' | 'cooperative' | 'group' | 'esusu' | 'custom_pot';
export type InterestMethod = 'flat' | 'compound' | 'tiered';
export type InterestCadence = 'daily' | 'monthly' | 'maturity';
export type SavingsAccountStatus = 'pending' | 'active' | 'matured' | 'withdrawn' | 'closed' | 'dormant';

export interface SavingsProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_type: SavingsProductType;
  description: string | null;
  interest_method: InterestMethod;
  interest_rate: number;
  interest_cadence: InterestCadence;
  minimum_balance: number;
  minimum_deposit: number;
  maximum_deposit: number | null;
  withdrawal_allowed: boolean;
  lock_period_days: number;
  early_withdrawal_penalty_rate: number;
  early_withdrawal_allowed: boolean;
  term_days: number | null;
  is_active: boolean;
  is_featured: boolean;
  metadata: Record<string, unknown>;
}

export interface SavingsAccount {
  id: string;
  account_number: string;
  customer_id: string;
  wallet_id: string;
  product_id: string;
  status: SavingsAccountStatus;
  opened_at: string | null;
  maturity_date: string | null;
  closed_at: string | null;
  product_terms_snapshot: Record<string, unknown>;
  total_interest_earned: number;
  last_interest_accrued_at: string | null;
  next_accrual_at: string | null;
  target_amount: number | null;
  pot_name?: string | null;
  pot_icon?: string | null;
  pot_color?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OpenAccountRequest {
  customer_id: string;
  wallet_id: string;
  product_id: string;
  target_amount?: number;
  initial_deposit?: number;
}

export interface DepositRequest {
  savings_account_id: string;
  wallet_id: string;
  amount: number;
  description?: string;
}

export interface WithdrawalRequest {
  savings_account_id: string;
  wallet_id: string;
  amount: number;
  description?: string;
}

export interface WithdrawalValidationResult {
  allowed: boolean;
  errors: string[];
  penalty_amount?: number;
  net_amount?: number;
}

export interface SavingsHistorySignal {
  customer_id: string;
  snapshot_date: string;
  total_savings_balance: number;
  active_account_count: number;
  product_diversity: number;
  savings_tenure_days: number;
  contribution_count_30d: number;
  contribution_count_90d: number;
  avg_balance_30d: number;
  avg_balance_90d: number;
  withdrawal_count_90d: number;
  total_interest_earned: number;
  consistency_score: number;
  stability_score: number;
  tenure_score: number;
}


// Custom Pot creation request
export interface OpenPotRequest {
  customer_id: string;
  wallet_id: string;
  product_id: string;
  pot_name: string;
  pot_icon?: string;
  pot_color?: string;
  lock_type: 'flexible' | 'locked';
  lock_until_date?: string | null;  // ISO date for locked pots
  target_amount?: number;
  initial_deposit?: number;
  interest_rate?: number;  // Calculated based on lock duration
}