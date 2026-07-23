/**
 * Agroesusu Credit Scoring Engine
 *
 * This is an INTERNAL PROXY scoring system — NOT an official credit bureau score.
 * If Safe Haven exposes a bureau/score endpoint, that should replace this module.
 *
 * Scoring factors:
 * - DVA transaction history/cashflow (via Safe Haven)
 * - Repayment history on prior Agroesusu loans
 * - Self-declared farm income + seasonality
 * - KYC completeness
 * - Account age / tenure
 */

export interface ScoringInputs {
  bvnVerified: boolean;
  kycTier: string;
  farmType: string | null;
  monthlyIncome: number | null;
  yearsFarming: number | null;
  dvaTransactionCount: number;
  priorLoansCount: number;
  priorLoansRepaidOnTime: number;
  existingActiveLoans: number;
  walletBalance: number;
  accountAgeDays: number;
}

export interface ScoringResult {
  score: number;          // 300–850 scale
  decision: 'auto_approved' | 'auto_declined' | 'manual_review';
  preQualifiedAmount: number;
  maxTenorDays: number;
  factors: {
    factor: string;
    points: number;
    note: string;
  }[];
}

export function calculateCreditScore(inputs: ScoringInputs): ScoringResult {
  const factors: { factor: string; points: number; note: string }[] = [];
  let score = 300; // base score

  // KYC completeness (max 80 points)
  if (inputs.bvnVerified) {
    score += 40;
    factors.push({ factor: 'BVN Verified', points: 40, note: 'Identity confirmed via BVN' });
  }
  if (inputs.kycTier === 'tier_2' || inputs.kycTier === 'tier_3') {
    score += 40;
    factors.push({ factor: 'KYC Tier 2+', points: 40, note: 'Enhanced due diligence complete' });
  } else if (inputs.kycTier === 'tier_1') {
    score += 20;
    factors.push({ factor: 'KYC Tier 1', points: 20, note: 'Basic KYC only' });
  }

  // Transaction history / cashflow (max 120 points)
  if (inputs.dvaTransactionCount > 20) {
    score += 120;
    factors.push({ factor: 'Strong transaction history', points: 120, note: `${inputs.dvaTransactionCount} transactions` });
  } else if (inputs.dvaTransactionCount > 10) {
    score += 80;
    factors.push({ factor: 'Moderate transaction history', points: 80, note: `${inputs.dvaTransactionCount} transactions` });
  } else if (inputs.dvaTransactionCount > 5) {
    score += 40;
    factors.push({ factor: 'Limited transaction history', points: 40, note: `${inputs.dvaTransactionCount} transactions` });
  } else {
    factors.push({ factor: 'No transaction history', points: 0, note: 'New account, no cashflow data' });
  }

  // Repayment history (max 150 points)
  if (inputs.priorLoansCount > 0) {
    const onTimeRate = inputs.priorLoansRepaidOnTime / inputs.priorLoansCount;
    if (onTimeRate >= 0.9) {
      score += 150;
      factors.push({ factor: 'Excellent repayment', points: 150, note: `${inputs.priorLoansRepaidOnTime}/${inputs.priorLoansCount} loans repaid on time` });
    } else if (onTimeRate >= 0.7) {
      score += 100;
      factors.push({ factor: 'Good repayment', points: 100, note: `${Math.round(onTimeRate * 100)}% on-time rate` });
    } else if (onTimeRate >= 0.5) {
      score += 50;
      factors.push({ factor: 'Fair repayment', points: 50, note: `${Math.round(onTimeRate * 100)}% on-time rate` });
    } else {
      factors.push({ factor: 'Poor repayment', points: 0, note: 'Significant delinquency on prior loans' });
    }
  } else {
    factors.push({ factor: 'No prior loans', points: 0, note: 'First-time borrower' });
  }

  // Income / affordability (max 120 points)
  if (inputs.monthlyIncome && inputs.monthlyIncome > 0) {
    if (inputs.monthlyIncome >= 500000) {
      score += 120;
      factors.push({ factor: 'High income', points: 120, note: `₦${inputs.monthlyIncome.toLocaleString()}/month` });
    } else if (inputs.monthlyIncome >= 200000) {
      score += 80;
      factors.push({ factor: 'Moderate income', points: 80, note: `₦${inputs.monthlyIncome.toLocaleString()}/month` });
    } else if (inputs.monthlyIncome >= 50000) {
      score += 40;
      factors.push({ factor: 'Low income', points: 40, note: `₦${inputs.monthlyIncome.toLocaleString()}/month` });
    } else {
      score += 10;
      factors.push({ factor: 'Very low income', points: 10, note: `₦${inputs.monthlyIncome.toLocaleString()}/month` });
    }
  }

  // Farming experience (max 80 points)
  if (inputs.yearsFarming) {
    if (inputs.yearsFarming >= 10) {
      score += 80;
      factors.push({ factor: 'Experienced farmer', points: 80, note: `${inputs.yearsFarming} years farming` });
    } else if (inputs.yearsFarming >= 5) {
      score += 50;
      factors.push({ factor: 'Established farmer', points: 50, note: `${inputs.yearsFarming} years farming` });
    } else if (inputs.yearsFarming >= 2) {
      score += 25;
      factors.push({ factor: 'Growing farmer', points: 25, note: `${inputs.yearsFarming} years farming` });
    } else {
      factors.push({ factor: 'New farmer', points: 0, note: `${inputs.yearsFarming} years farming` });
    }
  }

  // Account age (max 50 points)
  if (inputs.accountAgeDays > 180) {
    score += 50;
    factors.push({ factor: 'Long-standing account', points: 50, note: `${Math.round(inputs.accountAgeDays / 30)} months` });
  } else if (inputs.accountAgeDays > 90) {
    score += 30;
    factors.push({ factor: 'Established account', points: 30, note: `${Math.round(inputs.accountAgeDays / 30)} months` });
  } else if (inputs.accountAgeDays > 30) {
    score += 15;
    factors.push({ factor: 'New account', points: 15, note: '1 month' });
  } else {
    factors.push({ factor: 'Very new account', points: 0, note: 'Less than 1 month' });
  }

  // Cap score at 850
  score = Math.min(score, 850);

  // Decisioning logic
  let decision: ScoringResult['decision'] = 'manual_review';
  let preQualifiedAmount = 0;
  let maxTenorDays = 91;

  if (score >= 650) {
    decision = 'auto_approved';
    // Scale pre-qualified amount with score
    preQualifiedAmount = Math.round((score - 600) / 250 * 5000000);
    maxTenorDays = 365;
  } else if (score < 450) {
    decision = 'auto_declined';
    preQualifiedAmount = 0;
    maxTenorDays = 0;
  } else {
    decision = 'manual_review';
    preQualifiedAmount = Math.round((score - 400) / 250 * 2000000);
    maxTenorDays = 180;
  }

  // Reduce pre-qualified if existing active loans
  if (inputs.existingActiveLoans > 0) {
    preQualifiedAmount = Math.round(preQualifiedAmount * 0.5);
  }

  return { score, decision, preQualifiedAmount, maxTenorDays, factors };
}
