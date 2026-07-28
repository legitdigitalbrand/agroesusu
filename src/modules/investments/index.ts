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
 * Return Guarantee Distinction:
 *   - 'guaranteed': Rate is contractually guaranteed (Fixed Income)
 *   - 'expected': Target rate, highly likely but not contractual (Money Market)
 *   - 'variable_pool': Returns depend on actual pool performance (Agricultural Pool, Cooperative Growth Fund)
 *     — returns come from admin-entered pool performance records, NOT from formula
 * 
 * Public API:
 *   - Products: listActiveProducts, getProduct, createProduct
 *   - Accounts: createInvestmentAccount, acceptRiskDisclosure, subscribe, redeem, rolloverInvestment, getInvestmentAccount, listCustomerAccounts, getAccountTransactions
 *   - Returns: calculateReturns, calculateManagementFee, processReturns, batchProcessReturns, processMaturities
 *   - Pool: recordPoolPerformance, getPoolPerformanceRecords, distributePoolReturns, getPoolDistributions, getCustomerPoolDistributions
 *   - Types: InvestmentProduct, InvestmentAccount, InvestmentTransaction, etc.
 */

// Products
export { listActiveProducts, getProduct, createProduct } from './products';

// Accounts (includes subscription, redemption, and rollover)
export {
  createInvestmentAccount, acceptRiskDisclosure, subscribe, redeem, rolloverInvestment,
  getInvestmentAccount, listCustomerAccounts, getAccountTransactions,
} from './accounts';

// Returns & Valuation
export {
  calculateReturns, calculateManagementFee, processReturns,
  batchProcessReturns, processMaturities,
} from './returns';

// Pool Performance & Distribution
export {
  recordPoolPerformance, getPoolPerformanceRecords,
  distributePoolReturns, getPoolDistributions, getCustomerPoolDistributions,
} from './pool-performance';

// Types
export type {
  InvestmentType, InvestmentStatus, ProductStatus, InvestmentTxType, RiskLevel,
  ReturnGuaranteeType,
  InvestmentProduct, InvestmentAccount, InvestmentTransaction,
  RiskDisclosureAcceptance,
  PoolPerformanceRecord, PoolPerformanceEntry, PoolDistribution,
  DistributionResult,
  SubscriptionRequest, RedemptionRequest, RolloverRequest, RolloverResult,
  SubscriptionResult, RedemptionResult, ReturnsResult,
} from './types';
