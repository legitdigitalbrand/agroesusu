// ============================================================================
// Orchestrator Types — The Calling Contract
//
// EXTENDED IN PHASE 8: Added investment_reinvest for auto-reinvestment.
// ============================================================================

export type FinancialTransactionType =
  | 'wallet_deposit'
  | 'incoming_deposit'
  | 'wallet_withdrawal'
  | 'wallet_withdrawal_reservation'
  | 'wallet_withdrawal_settlement'
  | 'wallet_transfer'
  | 'savings_contribution'
  | 'savings_withdrawal'
  | 'savings_interest'
  | 'loan_disbursement'
  | 'loan_repayment'
  | 'loan_interest'
  | 'loan_penalty'
  | 'group_contribution'
  | 'group_payout'
  | 'investment_subscription'
  | 'investment_redemption'
  | 'investment_returns'
  | 'investment_reinvest'
  | 'fee_charge'
  | 'fee_reversal'
  | 'reversal'
  | 'adjustment';

export type SourceModule = 'wallet' | 'savings' | 'loans' | 'cooperative' | 'investments' | 'group_savings' | 'orchestrator' | 'admin';

export type FTStatus = 'initiated' | 'validated' | 'posting' | 'posted' | 'completed' | 'failed' | 'reversed';

export interface FinancialTransactionRequest {
  transaction_type: FinancialTransactionType;
  source_module: SourceModule;
  source_reference: string;
  amount: number;
  currency: string;
  description: string;
  idempotency_key: string;
  wallet_id?: string;
  product_account_id?: string;
  metadata?: Record<string, unknown>;
}

export interface FinancialTransactionResult {
  id: string;
  transaction_reference: string;
  status: FTStatus;
  journal_entry_id?: string;
  amount: number;
  description: string;
  error?: string;
}

export interface ReversalRequest {
  original_transaction_id: string;
  reason: string;
  idempotency_key: string;
}
