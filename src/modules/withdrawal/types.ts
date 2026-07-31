// ═══════════════════════════════════════════════════════════════
// External Bank Withdrawal — Types
// ═══════════════════════════════════════════════════════════════

export type WithdrawalStatus =
  | 'initiated'
  | 'name_enquiry_completed'
  | 'authorized'
  | 'reserved'
  | 'transfer_submitted'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'reversed'
  | 'requires_reconciliation'
  | 'cancelled';

export interface NameEnquiryRequest {
  bankCode: string;
  accountNumber: string;
}

export interface NameEnquiryResult {
  sessionId: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface WithdrawalLimits {
  minWithdrawal: number;
  maxPerTransaction: number;
  maxDaily: number;
  maxMonthly: number;
}

export interface WithdrawalValidationResult {
  valid: boolean;
  errors: string[];
  limits: WithdrawalLimits;
  availableBalance: number;
  tier: number;
}

export interface InitiateWithdrawalRequest {
  wallet_id: string;
  amount: number;
  beneficiary_bank_code: string;
  beneficiary_account_number: string;
  beneficiary_account_name: string;  // Verified from name enquiry
  name_enquiry_session_id: string;    // From name enquiry
  narration?: string;
}

export interface WithdrawalResult {
  id: string;
  status: WithdrawalStatus;
  payment_reference: string;
  amount: number;
  fee: number;
  message?: string;
}

export interface ReconciliationResult {
  status: 'completed' | 'failed' | 'pending' | 'requires_reconciliation';
  safe_haven_reference?: string;
  message: string;
}
