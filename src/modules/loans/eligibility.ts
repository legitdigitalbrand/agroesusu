// ============================================================================
// Eligibility Engine — "Savings First" Lending Decisions
// 
// The core of the Loan Engine. Consumes Phase 5's savings_history_signals
// + customer risk profile + loan product config to produce a defensible
// eligibility decision with a structured, stored rationale.
// 
// Every eligibility decision (automated or admin-overridden) is logged
// with its full rationale — which factors were checked, their values,
// thresholds, and whether they passed. No silent approvals or denials.
// 
// Cooperative participation is a STUB — the interface is defined but
// returns "not_available". Phase 7 will supply this data.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getProduct } from './products';
import { getCooperativeParticipation as getCoopParticipation } from '@/modules/cooperative';
import type {
  CooperativeParticipation, ApplyLoanRequest,
  EligibilityResult, EligibilityFactor,
} from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Get cooperative participation for a customer.
 * 
 * STUB: Returns "not_available" — Phase 7 will implement this.
 * When Phase 7 is ready, replace this function with a call to the
 * cooperative module that returns actual membership data.
 * 
 * The interface that Phase 7 must supply:
 *   status: 'verified' | 'not_member' | 'not_available'
 *   cooperative_id?: string
 *   membership_tenure_days?: number
 *   participation_score?: number (0-100)
 */
async function getCooperativeParticipation(customerId: string): Promise<CooperativeParticipation> {
  // PHASE 7: Now wired to the real cooperative module.
  // Reads the latest cooperative_participation_signal and returns the shape
  // that this engine expects: {status, cooperative_id, membership_tenure_days, participation_score}
  const participation = await getCoopParticipation(customerId);
  return participation as CooperativeParticipation;
}

/**
 * Compute internal credit score from savings signals + risk profile.
 * 
 * Score range: 300-850 (standard credit score range)
 * 
 * Components:
 *   Base: 300
 *   + tenure_score × 2.0 (max +200)
 *   + consistency_score × 1.5 (max +150)
 *   + stability_score × 1.0 (max +100)
 *   - defaulted_loans × 100
 *   - late_repayments × 10
 * 
 * This is an internal credit score — not a bureau score. It's based
 * entirely on the customer's savings behavior and loan history within
 * this platform.
 */
export function computeCreditScore(
  tenureScore: number,
  consistencyScore: number,
  stabilityScore: number,
  defaultedLoans: number,
  lateRepayments: number,
): number {
  let score = 300;
  score += Math.min(200, tenureScore * 2.0);
  score += Math.min(150, consistencyScore * 1.5);
  score += Math.min(100, stabilityScore * 1.0);
  score -= defaultedLoans * 100;
  score -= lateRepayments * 10;
  return Math.max(300, Math.min(850, Math.round(score)));
}

/**
 * Evaluate loan eligibility for a customer.
 * 
 * This is the main entry point. It:
 *   1. Reads the latest savings_history_signal
 *   2. Reads the customer's risk profile
 *   3. Checks cooperative participation (stub)
 *   4. Checks each product-specific rule
 *   5. Computes internal credit score
 *   6. Returns a structured decision with rationale
 * 
 * Returns: EligibilityResult with decision, factors, and rationale
 */
export async function evaluateEligibility(
  request: ApplyLoanRequest
): Promise<EligibilityResult> {
  const supabase = getServiceClient();
  const factors: EligibilityFactor[] = [];

  // 1. Get the loan product
  const product = await getProduct(request.product_id);
  if (!product) {
    return {
      decision: 'denied',
      approved_amount: 0,
      factors: [],
      credit_score: 0,
      savings_balance: 0,
      max_eligible_amount: 0,
      cooperative_status: 'not_available',
      rationale: 'Loan product not found',
    };
  }

  // 2. Read latest savings history signal
  const { data: signal } = await supabase
    .from('savings_history_signals')
    .select('*')
    .eq('customer_id', request.customer_id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const savingsBalance = signal ? Number(signal.total_savings_balance) : 0;
  const tenureDays = signal ? Number(signal.savings_tenure_days) : 0;
  const consistencyScore = signal ? Number(signal.consistency_score) : 0;
  const stabilityScore = signal ? Number(signal.stability_score) : 0;
  const tenureScore = signal ? Number(signal.tenure_score) : 0;

  // 3. Read customer risk profile
  const { data: riskProfile } = await supabase
    .from('customer_risk_profiles')
    .select('*')
    .eq('customer_id', request.customer_id)
    .maybeSingle();

  const defaultedLoans = riskProfile ? Number(riskProfile.defaulted_loans) : 0;
  const lateRepayments = riskProfile ? Number(riskProfile.late_repayments) : 0;
    const riskLevel = riskProfile ? riskProfile.risk_level : 'low';

  // 4. Check cooperative participation (STUB)
  const cooperativeParticipation = await getCooperativeParticipation(request.customer_id);

  // 5. Compute internal credit score
  const creditScore = computeCreditScore(
    tenureScore, consistencyScore, stabilityScore,
    defaultedLoans, lateRepayments
  );

  // 6. Check each eligibility factor
  let allPassed = true;
  let amountAdjusted = false;
  let approvedAmount = request.requested_amount;

  // Factor 1: Savings balance × multiplier ≥ requested amount
  const maxEligibleAmount = savingsBalance * product.savings_multiplier;
  const savingsCheckPassed = maxEligibleAmount >= request.requested_amount;
  factors.push({
    factor: 'savings_multiplier',
    value: `₦${savingsBalance.toFixed(2)} × ${product.savings_multiplier} = ₦${maxEligibleAmount.toFixed(2)}`,
    threshold: `₦${request.requested_amount.toFixed(2)}`,
    passed: savingsCheckPassed,
    weight: 40,
    contribution: savingsCheckPassed
      ? 'Savings balance supports requested amount'
      : `Max eligible: ₦${maxEligibleAmount.toFixed(2)} (below requested ₦${request.requested_amount.toFixed(2)})`,
  });
  if (!savingsCheckPassed) {
    allPassed = false;
    // Amount adjust: approve at max eligible if it meets min_amount
    if (maxEligibleAmount >= product.min_amount) {
      amountAdjusted = true;
      approvedAmount = maxEligibleAmount;
    }
  }

  // Factor 2: Savings tenure
  const tenurePassed = tenureDays >= product.min_savings_tenure_days;
  factors.push({
    factor: 'savings_tenure',
    value: `${tenureDays} days`,
    threshold: `${product.min_savings_tenure_days} days`,
    passed: tenurePassed,
    weight: 20,
    contribution: tenurePassed
      ? 'Savings tenure meets minimum requirement'
      : `Insufficient savings tenure (${tenureDays}/${product.min_savings_tenure_days} days)`,
  });
  if (!tenurePassed) allPassed = false;

  // Factor 3: Consistency score
  const consistencyPassed = consistencyScore >= product.min_consistency_score;
  factors.push({
    factor: 'consistency_score',
    value: consistencyScore,
    threshold: product.min_consistency_score,
    passed: consistencyPassed,
    weight: 15,
    contribution: consistencyPassed
      ? 'Savings consistency meets minimum threshold'
      : `Consistency score ${consistencyScore} below required ${product.min_consistency_score}`,
  });
  if (!consistencyPassed) allPassed = false;

  // Factor 4: Stability score
  const stabilityPassed = stabilityScore >= product.min_stability_score;
  factors.push({
    factor: 'stability_score',
    value: stabilityScore,
    threshold: product.min_stability_score,
    passed: stabilityPassed,
    weight: 10,
    contribution: stabilityPassed
      ? 'Savings stability meets minimum threshold'
      : `Stability score ${stabilityScore} below required ${product.min_stability_score}`,
  });
  if (!stabilityPassed) allPassed = false;

  // Factor 5: Internal credit score
  const creditScorePassed = creditScore >= product.min_credit_score;
  factors.push({
    factor: 'credit_score',
    value: creditScore,
    threshold: product.min_credit_score,
    passed: creditScorePassed,
    weight: 10,
    contribution: creditScorePassed
      ? 'Internal credit score meets minimum'
      : `Credit score ${creditScore} below required ${product.min_credit_score}`,
  });
  if (!creditScorePassed) allPassed = false;

  // Factor 6: Risk level check
  const riskPassed = riskLevel !== 'restricted';
  factors.push({
    factor: 'risk_level',
    value: riskLevel,
    threshold: 'not restricted',
    passed: riskPassed,
    weight: 5,
    contribution: riskPassed
      ? `Customer risk level: ${riskLevel}`
      : 'Customer is restricted due to multiple defaults',
  });
  if (!riskPassed) allPassed = false;

  // Factor 7: Cooperative membership (if required)
  if (product.requires_cooperative_membership) {
    const coopPassed = cooperativeParticipation.status === 'verified';
    factors.push({
      factor: 'cooperative_membership',
      value: cooperativeParticipation.status,
      threshold: 'verified',
      passed: coopPassed,
      weight: 5,
      contribution: coopPassed
        ? 'Cooperative membership verified'
        : cooperativeParticipation.status === 'not_available'
          ? 'Cooperative membership data available but customer is not a cooperative member'
          : 'Customer is not a cooperative member',
    });
    if (!coopPassed) allPassed = false;
  }

  // Factor 8: Min/max amount check
  const minAmountPassed = request.requested_amount >= product.min_amount;
  factors.push({
    factor: 'min_amount',
    value: `₦${request.requested_amount.toFixed(2)}`,
    threshold: `₦${product.min_amount.toFixed(2)}`,
    passed: minAmountPassed,
    weight: 0,
    contribution: minAmountPassed
      ? 'Requested amount meets minimum'
      : `Requested amount below minimum of ₦${product.min_amount.toFixed(2)}`,
  });
  if (!minAmountPassed) allPassed = false;

  // 7. Determine final decision
  let decision: EligibilityResult['decision'];
  if (!allPassed) {
    decision = 'denied';
    approvedAmount = 0;
  } else if (amountAdjusted) {
    decision = 'amount_adjusted';
  } else {
    decision = 'approved';
  }

  // 8. Build rationale string
  const failedFactors = factors.filter(f => !f.passed);
  const rationale = failedFactors.length === 0
    ? `Loan approved for ₦${approvedAmount.toFixed(2)}. All ${factors.length} eligibility checks passed. Credit score: ${creditScore}.`
    : `Loan ${decision === 'denied' ? 'denied' : 'approved at adjusted amount ₦' + approvedAmount.toFixed(2)}. Failed checks: ${failedFactors.map(f => f.factor).join(', ')}.`;

  return {
    decision,
    approved_amount: approvedAmount,
    factors,
    credit_score: creditScore,
    savings_balance: savingsBalance,
    max_eligible_amount: maxEligibleAmount,
    cooperative_status: cooperativeParticipation.status,
    rationale,
  };
}

/**
 * Store an eligibility decision in the audit trail.
 * Every decision (automated or admin override) is logged.
 */
export async function logEligibilityDecision(
  customerId: string,
  productId: string,
  result: EligibilityResult,
  requestedAmount: number,
  loanId?: string,
  source: 'automated' | 'admin_override' = 'automated',
  overrideReason?: string,
  overrideBy?: string,
): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('loan_eligibility_decisions')
    .insert({
      loan_id: loanId || null,
      customer_id: customerId,
      product_id: productId,
      decision: result.decision,
      source,
      requested_amount: requestedAmount,
      approved_amount: result.approved_amount,
      factors: result.factors,
      credit_score: result.credit_score,
      savings_balance: result.savings_balance,
      max_eligible_amount: result.max_eligible_amount,
      cooperative_status: result.cooperative_status,
      override_reason: overrideReason || null,
      override_by: overrideBy || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to log eligibility decision: ${error.message}`);
  return data.id;
}
