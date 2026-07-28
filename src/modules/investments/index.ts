/**
 * Investment & Wealth Management Module
 * 
 * Phase 8: Investment products (fixed income, unitized, cooperative funds,
 * money market, agricultural pools), subscription/redemption/returns through
 * the Orchestrator, mandatory risk disclosure, and daily returns processing.
 * 
 * Key principle: Investments are DISTINCT from Savings — separate module,
 * shared infrastructure (Wallet, Ledger, Orchestrator).
 * 
 * Public API:
 *   - Products: listActiveProducts, getProduct, createProduct
 *   - Accounts: createInvestmentAccount, acceptRiskDisclosure, subscribe, redeem, getInvestmentAccount, listCustomerAccounts, getAccountTransactions
 *   - Returns: calculateReturns, calculateManagementFee, processReturns, batchProcessReturns, processMaturities
 *   - Types: InvestmentProduct, InvestmentAccount, InvestmentTransaction, etc.
 */

// Products
export { listActiveProducts, getProduct, createProduct } from './products';

// Accounts (includes subscription and redemption)
export {
  createInvestmentAccount, acceptRiskDisclosure, subscribe, redeem,
  getInvestmentAccount, listCustomerAccounts, getAccountTransactions,
} from './accounts';

// Returns & Valuation
export {
  calculateReturns, calculateManagementFee, processReturns,
  batchProcessReturns, processMaturities,
} from './returns';

// Types
export type {
  InvestmentType, InvestmentStatus, ProductStatus, InvestmentTxType, RiskLevel,
  InvestmentProduct, InvestmentAccount, InvestmentTransaction,
  RiskDisclosureAcceptance, SubscriptionRequest, RedemptionRequest,
  SubscriptionResult, RedemptionResult, ReturnsResult,
} from './types';
