/**
 * Savings Engine Module
 * 
 * Manages:
 *   - Product configuration (admin-configurable savings products)
 *   - Account lifecycle (open, activate, mature, close)
 *   - Deposit flow (validates → calls Orchestrator)
 *   - Withdrawal flow (validates lock/penalty rules → calls Orchestrator)
 *   - Interest accrual (scheduled → posts through Orchestrator)
 *   - History signals (for credit scoring)
 *   - Savings Goals (goal metadata on savings_accounts: target, date, monthly target)
 * 
 * All financial movements go through the Orchestrator — no direct ledger writes.
 */

// Product management
export { listActiveProducts, getProduct, getProductByCode, createProduct, updateProduct } from './products';

// Account lifecycle
export { openAccount, openCustomPot, activateAccount, getAccount, listCustomerAccounts, getSavingsBalance, markAsMatured, closeAccount, updateAccountGoal } from './accounts';
export type { AccountWithProduct } from './accounts';
export type { OpenPotRequest } from './types';

// Deposit flow
export { deposit } from './deposit';

// Withdrawal flow
export { validateWithdrawal, withdraw } from './withdrawal';

// Interest accrual
export { calculateInterest, accrueInterest, accrueInterestForAllAccounts } from './interest';

// History signals
export { computeSavingsSignal, computeAllSavingsSignals, getLatestSignal } from './history';

// Savings Goals (goal metadata on savings_accounts)
export { createGoal, getGoalByAccountId, getGoalsForAccounts, updateGoal, archiveGoal, calculateProgress, getMilestone, getInsight } from './goals';
export type { SavingsGoal } from './goals';

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
