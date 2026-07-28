// ============================================================================
// Wallet Domain Types
// 
// Phase 3: Transaction history read model + balance cache maintenance.
// These types are for the wallet module's internal use and public API.
// ============================================================================

// Transaction status lifecycle: pending → confirmed / failed
// Reversals create NEW rows (original stays confirmed)
export type WalletTxStatus = 'pending' | 'confirmed' | 'failed' | 'reversed';

export type WalletTxDirection = 'credit' | 'debit';

export type WalletTxSource = 
  | 'safe_haven_webhook'
  | 'internal_operation'
  | 'reconciliation_adjustment'
  | 'system_initialization';

export type WalletTxType =
  | 'deposit'
  | 'transfer_in'
  | 'transfer_out'
  | 'withdrawal'
  | 'fee'
  | 'interest'
  | 'penalty'
  | 'loan_disbursement'
  | 'loan_repayment'
  | 'reversal'
  | 'adjustment'
  | 'unknown';

// Processed transaction record (as returned by queries)
export interface WalletTransaction {
  id: string;
  transaction_reference: string;
  external_reference: string | null;
  wallet_id: string;
  direction: WalletTxDirection;
  amount: number;
  currency: string;
  transaction_type: WalletTxType;
  narration: string | null;
  source: WalletTxSource;
  status: WalletTxStatus;
  counterparty_account_number: string | null;
  counterparty_account_name: string | null;
  counterparty_bank_code: string | null;
  counterparty_bank_name: string | null;
  confirmed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  reversal_of: string | null;
  reversed_by: string | null;
  created_at: string;
}

// Balance response
export interface WalletBalance {
  wallet_id: string;
  wallet_number: string;
  cached_balance: number;
  cached_available_balance: number;
  cached_ledger_balance: number;
  reserved_balance: number;
  currency: string;
  last_updated: string | null;
  status: string;
}

// Pagination
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedTransactions {
  transactions: WalletTransaction[];
  pagination: Pagination;
}

// Event processing result
export interface ProcessEventResult {
  event_id: string;
  status: 'processed' | 'failed' | 'skipped';
  transaction_id?: string;
  error?: string;
}

export interface ProcessBatchResult {
  processed: number;
  failed: number;
  skipped: number;
  results: ProcessEventResult[];
}

// Reconciliation
export interface ReconciliationResult {
  wallet_id: string;
  our_balance: number;
  sh_balance: number | null;
  discrepancy: number | null;
  status: 'matched' | 'discrepancy' | 'error';
  flag_id?: string;
  error?: string;
}

export type ReconciliationStatus = 'open' | 'investigating' | 'resolved' | 'escalated';

export interface ReconciliationFlag {
  id: string;
  wallet_id: string;
  our_balance: number;
  sh_balance: number;
  discrepancy_amount: number;
  discrepancy_direction: 'positive' | 'negative';
  status: ReconciliationStatus;
  checked_at: string;
  resolution_notes: string | null;
  investigated_by: string | null;
}
