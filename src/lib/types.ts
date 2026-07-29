// ============================================================================
// Agriqcap Domain Types
// ============================================================================

export type SavingsPlanType =
  | "farm_expansion" | "poultry_feed" | "tractor_purchase" | "seeds"
  | "fertilizer" | "harvest_savings" | "school_fees" | "emergency_fund"
  | "equipment_purchase" | "livestock_purchase" | "custom";

export type SavingsFrequency = "daily" | "weekly" | "monthly";
export type SavingsStatus = "active" | "paused" | "completed" | "cancelled";

export type LoanType =
  | "crop" | "poultry" | "fish_farming" | "equipment"
  | "greenhouse" | "livestock" | "farm_expansion" | "working_capital";

export type LoanApplicationStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected";
export type LoanStatus = "active" | "disbursed" | "completed" | "overdue" | "defaulted";
export type RepaymentStatus = "pending" | "paid" | "overdue" | "partial";

export type TransactionType =
  | "funding" | "savings_deposit" | "savings_withdrawal" | "interest_earned"
  | "loan_disbursement" | "loan_repayment" | "penalty";

export type TransactionDirection = "credit" | "debit";
export type TransactionStatus = "pending" | "success" | "failed";

export type KYCTier = "tier_0" | "tier_1" | "tier_2" | "tier_3";
export type UserRole = "user" | "admin";

export type NotificationType =
  | "savings_success" | "loan_approved" | "repayment_due"
  | "repayment_successful" | "missed_repayment" | "goal_reached"
  | "kyc_approved" | "kyc_rejected";

// Database record types
export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  bvn: string | null;
  nin: string | null;
  residential_address: string | null;
  state: string | null;
  lga: string | null;
  occupation: string | null;
  farm_type: string | null;
  farm_size: number | null;
  years_farming: number | null;
  primary_produce: string | null;
  expected_harvest: string | null;
  annual_revenue: number | null;
  business_name: string | null;
  business_type: string | null;
  business_registration_number: string | null;
  nok_name: string | null;
  nok_phone: string | null;
  nok_relationship: string | null;
  transaction_pin: string | null;
  kyc_tier: KYCTier;
  kyc_verified_at: string | null;
  role: UserRole;
  two_factor_enabled: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  safe_haven_customer_id: string | null;
  account_number: string | null;
  account_name: string | null;
  bank_name: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface SavingsPlan {
  id: string;
  user_id: string;
  name: string;
  plan_type: SavingsPlanType;
  goal_amount: number;
  target_date: string | null;
  current_balance: number;
  savings_frequency: SavingsFrequency;
  contribution_amount: number;
  auto_debit_enabled: boolean;
  interest_rate: number;
  interest_earned: number;
  status: SavingsStatus;
  safe_haven_account_number: string | null;
  early_withdrawal_penalty: number;
  created_at: string;
  updated_at: string;
}

export interface SavingsContribution {
  id: string;
  savings_plan_id: string;
  user_id: string;
  amount: number;
  type: "deposit" | "withdrawal" | "interest";
  status: TransactionStatus;
  safe_haven_reference: string | null;
  created_at: string;
}

export interface LoanApplication {
  id: string;
  user_id: string;
  loan_type: LoanType;
  requested_amount: number;
  purpose: string;
  repayment_duration_months: number;
  farm_size: number | null;
  business_type: string | null;
  years_operating: number | null;
  expected_harvest: string | null;
  annual_revenue: number | null;
  status: LoanApplicationStatus;
  interest_rate: number | null;
  monthly_repayment: number | null;
  total_repayable: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  loan_application_id: string;
  user_id: string;
  principal_amount: number;
  interest_rate: number;
  total_repayable: number;
  outstanding_balance: number;
  monthly_repayment: number;
  duration_months: number;
  status: LoanStatus;
  disbursement_date: string | null;
  maturity_date: string | null;
  safe_haven_disbursement_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanRepayment {
  id: string;
  loan_id: string;
  user_id: string;
  installment_number: number;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
  status: RepaymentStatus;
  safe_haven_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string | null;
  savings_plan_id: string | null;
  loan_id: string | null;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  description: string | null;
  reference: string;
  safe_haven_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KYCDocument {
  id: string;
  user_id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  status: "pending" | "approved" | "rejected";
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface AdminSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}
