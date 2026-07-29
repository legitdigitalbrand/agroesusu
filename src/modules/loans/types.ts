// ============================================================================
// Loan Engine — Type Definitions
// ============================================================================

export type LoanProductType = 'salary' | 'sme' | 'agricultural';
export type LoanInterestMethod = 'flat' | 'reducing_balance';
export type LoanStatus = 'applied' | 'approved' | 'denied' | 'disbursed' | 'active' | 'closed' | 'defaulted' | 'restructured' | 'written_off';
export type InstallmentStatus = 'pending' | 'due' | 'paid' | 'late' | 'defaulted' | 'partial';
export type EligibilityDecision = 'approved' | 'denied' | 'amount_adjusted';
export type EligibilitySource = 'automated' | 'admin_override';
export type RiskLevel = 'low' | 'medium' | 'high' | 'restricted';

export interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_type: LoanProductType;
  description: string | null;
  interest_method: LoanInterestMethod;
  interest_rate: number;
  min_term_months: number;
  max_term_months: number;
  default_term_months: number;
  savings_multiplier: number;
  min_savings_tenure_days: number;
  min_consistency_score: number;
  min_stability_score: number;
  min_credit_score: number;
  min_amount: number;
  max_amount: number | null;
  origination_fee_rate: number;
  processing_fee: number;
  late_payment_penalty_rate: number;
  grace_period_days: number;
  max_missed_installments: number;
  requires_cooperative_membership: boolean;
  min_kyc_level: string;
  is_active: boolean;
  is_featured: boolean;
  metadata: Record<string, unknown>;
}

export interface Loan {
  id: string;
  loan_number: string;
  customer_id: string;
  wallet_id: string;
  product_id: string;
  requested_amount: number;
  approved_amount: number | null;
  principal_amount: number | null;
  total_interest: number;
  total_payable: number;
  interest_rate: number;
  interest_method: string;
  term_months: number;
  status: LoanStatus;
  applied_at: string;
  approved_at: string | null;
  denied_at: string | null;
  disbursed_at: string | null;
  closed_at: string | null;
  defaulted_at: string | null;
  total_repaid: number;
  total_interest_paid: number;
  total_penalty_charged: number;
  next_due_date: string | null;
  last_repayment_at: string | null;
  eligibility_decision_id: string | null;
  disbursement_ft_id: string | null;
  agreement_accepted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Installment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  amount_paid: number;
  principal_paid: number;
  interest_paid: number;
  penalty_charged: number;
  status: InstallmentStatus;
  paid_at: string | null;
  days_late: number;
}

export interface EligibilityFactor {
  factor: string;
  value: number | string;
  threshold: number | string;
  passed: boolean;
  weight: number;
  contribution: string;
}

export interface EligibilityResult {
  decision: EligibilityDecision;
  approved_amount: number;
  factors: EligibilityFactor[];
  credit_score: number;
  savings_balance: number;
  max_eligible_amount: number;
  cooperative_status: string;
  rationale: string;
}

export interface CooperativeParticipation {
  status: 'verified' | 'not_member' | 'not_available';
  cooperative_id?: string;
  membership_tenure_days?: number;
  participation_score?: number;
}

export interface ApplyLoanRequest {
  customer_id: string;
  wallet_id: string;
  product_id: string;
  requested_amount: number;
  term_months?: number;
}

export interface RepaymentRequest {
  loan_id: string;
  wallet_id: string;
  amount: number;
}

export interface CustomerRiskProfile {
  id: string;
  customer_id: string;
  risk_level: RiskLevel;
  internal_credit_score: number;
  total_loans: number;
  active_loans: number;
  defaulted_loans: number;
  closed_loans: number;
  total_repayments: number;
  on_time_repayments: number;
  late_repayments: number;
  total_penalty_paid: number;
  last_default_date: string | null;
  metadata: Record<string, unknown>;
}
