/**
 * AgroEsusu — Loan Integration Configuration
 *
 * IMPORTANT: LOANS_LIVE_MODE defaults to false. This means all loan
 * disbursements run in sandbox/test-mode. Do not set this to true until:
 * 1. State Money Lender's Licence is obtained
 * 2. FCCPC registration under the digital lending framework is complete
 * 3. Actual lending capital has been allocated
 *
 * This is a business/legal gate, not a technical one.
 */

// The master feature flag. When false:
// - Loan applications are accepted but disbursement is simulated (pot_credit, not real transfer)
// - The admin dashboard shows a clear "SANDBOX MODE" banner
// - No real money leaves the platform
export const LOANS_LIVE_MODE = false;

// ─── Eligibility Tiers ───
export interface LoanTierConfig {
  tier: 'starter' | 'established' | 'trusted';
  label: string;
  minAmount: number;        // ₦
  maxAmount: number;         // ₦
  aprRange: { min: number; max: number };  // Annual Percentage Rate (%), risk-based
  // Eligibility criteria
  minSavingMonths: number;
  minCompletedCycles: number;
  minCreditScore: number;
  requiresPriorLoan: boolean;
  // Late fee for this tier (can differ by risk)
  lateFeeFlat: number;      // ₦ — disclosed in terms before acceptance
}

export const TIER_CONFIGS: Record<string, LoanTierConfig> = {
  starter: {
    tier: 'starter',
    label: 'Starter',
    minAmount: 5000,
    maxAmount: 30000,
    aprRange: { min: 28, max: 35 },   // Higher APR — no credit history, higher risk
    minSavingMonths: 1,
    minCompletedCycles: 0,
    minCreditScore: 300,
    requiresPriorLoan: false,
    lateFeeFlat: 1000,
  },
  established: {
    tier: 'established',
    label: 'Established',
    minAmount: 30000,
    maxAmount: 150000,
    aprRange: { min: 22, max: 28 },   // Moderate APR — some history
    minSavingMonths: 3,
    minCompletedCycles: 1,
    minCreditScore: 500,
    requiresPriorLoan: false,
    lateFeeFlat: 2000,
  },
  trusted: {
    tier: 'trusted',
    label: 'Trusted',
    minAmount: 150000,
    maxAmount: 500000,
    aprRange: { min: 18, max: 24 },   // Lowest APR — proven repayment history
    minSavingMonths: 6,
    minCompletedCycles: 2,
    minCreditScore: 700,
    requiresPriorLoan: true,
    lateFeeFlat: 3000,
  },
};

// ─── APR Calculation ───
/**
 * Calculates the interest amount for a loan based on APR and term.
 * APR is prorated for the actual loan duration (simple interest, not compound).
 *
 * @param principal - Loan amount in Naira
 * @param apr - Annual Percentage Rate (e.g. 30 for 30%)
 * @param installments - Number of weekly installments
 * @returns { interestAmount, totalRepayable, apr, effectiveRate }
 */
export function calculateLoanInterest(
  principal: number,
  apr: number,
  installments: number,
): { interestAmount: number; totalRepayable: number; apr: number; effectiveRate: number } {
  const weeksPerYear = 52;
  const loanWeeks = installments; // each installment = 1 week
  const effectiveRate = (apr / 100) * (loanWeeks / weeksPerYear);
  const interestAmount = Math.round(principal * effectiveRate);
  const totalRepayable = principal + interestAmount;

  return { interestAmount, totalRepayable, apr, effectiveRate };
}

/**
 * Determines the actual APR for a user based on their tier and credit score.
 * Higher credit scores within a tier get the lower end of the APR range.
 */
export function determineAPR(
  tier: 'starter' | 'established' | 'trusted',
  creditScore: number,
): number {
  const config = TIER_CONFIGS[tier];
  const { min, max } = config.aprRange;

  // Map credit score within tier's range to APR within tier's APR range
  // Higher credit score → lower APR (inverse relationship)
  const scoreMin = config.minCreditScore;
  const scoreRange = 200; // assumed range within tier
  const scoreRatio = Math.min(1, Math.max(0, (creditScore - scoreMin) / scoreRange));
  // Inverse: high score → low APR
  const apr = max - (max - min) * scoreRatio;

  return Math.round(apr * 100) / 100; // round to 2 decimal places
}

// ─── Repayment Options ───
export const REPAYMENT_SCHEDULES = [
  { installments: 4, label: '4 weekly installments' },
  { installments: 8, label: '8 weekly installments' },
  { installments: 12, label: '12 weekly installments' },
];

// ─── Missed Payment Timeline ───
export const GRACE_PERIOD_DAYS = 3;
export const RESTRICTION_START_DAYS = 4;
export const MANUAL_REVIEW_DAYS = 14;
export const MAX_AUTO_RETRY_ATTEMPTS = 2;

// ─── Reference Prefixes ───
export const LOAN_REF = {
  disbursement: 'AGC_LDB',    // loan disbursement (transfer)
  repayment: 'AGC_LRP',       // loan repayment (charge)
  autoDeduct: 'AGC_LAD',      // loan auto-deduction
};

// ─── Credit Score Formula Weights ───
export const CREDIT_SCORE_WEIGHTS = {
  savingsConsistency: 0.30,   // months of active saving
  savingsVolume: 0.20,        // total saved amount
  esusuCompletion: 0.20,      // completed cycles without missed contributions
  repaymentHistory: 0.30,     // on-time repayment of past loans
};

// Base credit score (what everyone starts with)
export const BASE_CREDIT_SCORE = 300;
export const MAX_CREDIT_SCORE = 850;
