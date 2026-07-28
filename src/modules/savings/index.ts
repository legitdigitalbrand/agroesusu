/**
 * Savings Engine Module
 * 
 * The first real consumer of the Orchestrator. Manages:
 *   - Product configuration (admin-configurable savings products)
 *   - Account lifecycle (open, activate, mature, close)
 *   - Deposit flow (validates → calls Orchestrator)
 *   - Withdrawal flow (validates lock/penalty rules → calls Orchestrator)
 *   - Interest accrual (scheduled → posts through Orchestrator)
 *   - History signals (for Phase 6 credit scoring)
 * 
 * All financial movements go through the Orchestrator — no direct ledger writes.
 */

// Product management
export { listActiveProducts, getProduct, getProductByCode, createProduct, updateProduct } from './products';

// Account lifecycle
export { openAccount, activateAccount, getAccount, listCustomerAccounts, getSavingsBalance, markAsMatured, closeAccount } from './accounts';

// Deposit flow
export { deposit } from './deposit';

// Withdrawal flow
export { validateWithdrawal, withdraw } from './withdrawal';

// Interest accrual
export { calculateInterest, accrueInterest, accrueInterestForAllAccounts } from './interest';

// History signals
export { computeSavingsSignal, computeAllSavingsSignals, getLatestSignal } from './history';

// Types
export type {
  SavingsProductType,
  InterestMethod,
  InterestCadence,
  SavingsAccountStatus,
  SavingsProduct,
  SavingsAccount,
  OpenAccountRequest,
  DepositRequest,
  WithdrawalRequest,
  WithdrawalValidationResult,
  SavingsHistorySignal,
} from './types';
