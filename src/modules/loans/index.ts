/**
 * Loan Engine Module
 * 
 * The "Savings First" lending system. Consumes Phase 5's savings history
 * signals to make defensible, auditable eligibility decisions.
 * 
 * All financial movements (disbursement, repayment, penalties) go through
 * the Orchestrator — no direct ledger writes.
 * 
 * Public API:
 *   - Products: listActiveProducts, getProduct, createProduct, updateProduct
 *   - Eligibility: evaluateEligibility, computeCreditScore, logEligibilityDecision
 *   - Aggregate: applyForLoan, adminOverrideDecision, getLoan, listCustomerLoans, acceptAgreement
 *   - Disbursement: disburseLoan
 *   - Repayment: repay
 *   - Collections: runCollectionsCheck
 *   - Risk: getRiskProfile, recalculateCreditScore
 *   - Schedule: generateSchedule, getSchedule, calculateTotalInterest
 */

// Products
export { listActiveProducts, getProduct, getProductByCode, createProduct, updateProduct } from './products';

// Eligibility
export { evaluateEligibility, computeCreditScore, logEligibilityDecision } from './eligibility';

// Aggregate (lifecycle)
export { applyForLoan, adminOverrideDecision, getLoan, listCustomerLoans, acceptAgreement } from './aggregate';

// Disbursement
export { disburseLoan } from './disbursement';

// Repayment
export { repay } from './repayment';

// Collections
export { runCollectionsCheck } from './collections';

// Risk
export { getRiskProfile, recalculateCreditScore } from './risk';

// Schedule
export { generateSchedule, getSchedule, calculateTotalInterest } from './schedule';

// Types
export type {
  LoanProductType, LoanInterestMethod, LoanStatus, InstallmentStatus,
  EligibilityDecision, EligibilitySource, RiskLevel,
  LoanProduct, Loan, Installment, EligibilityFactor, EligibilityResult,
  CooperativeParticipation, ApplyLoanRequest, RepaymentRequest, CustomerRiskProfile,
} from './types';
