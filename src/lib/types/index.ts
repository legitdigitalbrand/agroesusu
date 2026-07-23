export type LoanStatus = 'pending_review' | 'scoring' | 'auto_approved' | 'auto_declined' | 'manual_review' | 'disbursed' | 'repaying' | 'closed' | 'defaulted';
export type KycTier = 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3';
export type FarmType = 'crop' | 'livestock' | 'mixed' | 'agro_processing' | 'input_dealer';
export type TransactionType = 'fund' | 'withdraw' | 'repay' | 'transfer_in' | 'transfer_out' | 'bill_pay';
export type SavingsFrequency = 'daily' | 'weekly' | 'monthly';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  bvn_verified: boolean;
  kyc_tier: KycTier;
  farm_type: FarmType | null;
  state: string | null;
  lga: string | null;
  farm_size: number | null;
  years_farming: number | null;
  primary_produce: string | null;
  monthly_income_estimate: number | null;
  credit_score: number | null;
  pre_qualified_amount: number | null;
  transaction_pin: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  safe_haven_account_number: string;
  safe_haven_account_name: string;
  bank_name: string;
  balance_cached: number;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  safe_haven_reference: string | null;
  counterparty: Record<string, unknown> | null;
  created_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  purpose: string;
  amount_requested: number;
  amount_approved: number | null;
  tenor_days: number;
  monthly_rate: number;
  status: LoanStatus;
  disbursed_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface LoanEvent {
  id: string;
  loan_id: string;
  event_type: string;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface RepaymentScheduleItem {
  id: string;
  loan_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: 'upcoming' | 'paid' | 'overdue' | 'partial';
}

export interface SavingsCircle {
  id: string;
  name: string;
  owner_id: string;
  contribution_amount: number;
  frequency: SavingsFrequency;
  member_count: number;
  payout_order_json: Record<string, unknown>;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

export interface FixedDeposit {
  id: string;
  user_id: string;
  principal: number;
  rate: number;
  term_days: number;
  maturity_date: string;
  status: 'active' | 'matured' | 'withdrawn';
}

export interface BillPayment {
  id: string;
  user_id: string;
  category: string;
  vendor: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  reference: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Card {
  id: string;
  user_id: string;
  card_type: 'virtual' | 'physical';
  last4: string;
  status: 'active' | 'frozen' | 'cancelled';
}
