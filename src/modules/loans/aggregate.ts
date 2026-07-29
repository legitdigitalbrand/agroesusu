// ============================================================================
// Loan Aggregate — Lifecycle Management
// 
// Manages loan applications through their lifecycle:
//   applied → approved/denied → disbursed → active → closed/defaulted
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getProduct } from './products';
import { evaluateEligibility, logEligibilityDecision } from './eligibility';
import { calculateTotalInterest } from './schedule';
import type { Loan, ApplyLoanRequest } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Apply for a loan.
 * Creates the loan record and runs eligibility evaluation.
 */
export async function applyForLoan(request: ApplyLoanRequest): Promise<{
  loan: Loan;
  eligibility_decision: string;
  eligibility_factors: unknown[];
  eligibility_rationale: string;
}> {
  const supabase = getServiceClient();

  // 1. Get product
  const product = await getProduct(request.product_id);
  if (!product) throw new Error('Loan product not found');

  // 2. Validate basic constraints
  if (request.requested_amount < product.min_amount) {
    throw new Error(`Minimum loan amount is ₦${product.min_amount}`);
  }
  if (product.max_amount && request.requested_amount > product.max_amount) {
    throw new Error(`Maximum loan amount is ₦${product.max_amount}`)
  }

  const termMonths = request.term_months || product.default_term_months;
  if (termMonths < product.min_term_months || termMonths > product.max_term_months) {
    throw new Error(`Term must be between ${product.min_term_months} and ${product.max_term_months} months`)
  }

  // 3. Create loan record (status: applied)
  const { data: loan, error } = await supabase
    .from('loans')
    .insert({
      customer_id: request.customer_id,
      wallet_id: request.wallet_id,
      product_id: request.product_id,
      requested_amount: request.requested_amount,
      status: 'applied',
      interest_rate: product.interest_rate,
      interest_method: product.interest_method,
      term_months: termMonths,
      product_terms_snapshot: {
        interest_rate: product.interest_rate,
        interest_method: product.interest_method,
        savings_multiplier: product.savings_multiplier,
        late_payment_penalty_rate: product.late_payment_penalty_rate,
        grace_period_days: product.grace_period_days,
        max_missed_installments: product.max_missed_installments,
        origination_fee_rate: product.origination_fee_rate,
        processing_fee: product.processing_fee,
      },
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create loan application: ${error.message}`);

  // 4. Run eligibility evaluation
  const eligibilityResult = await evaluateEligibility(request);

  // 5. Log the eligibility decision (audit trail)
  const decisionId = await logEligibilityDecision(
    request.customer_id,
    request.product_id,
    eligibilityResult,
    request.requested_amount,
    loan.id,
    'automated',
  );

  // 6. Update loan status based on decision
  if (eligibilityResult.decision === 'denied') {
    await supabase.from('loans').update({
      status: 'denied',
      denied_at: new Date().toISOString(),
      eligibility_decision_id: decisionId,
    }).eq('id', loan.id);
  } else {
    // approved or amount_adjusted
    const approvedAmount = eligibilityResult.approved_amount;
    const totalInterest = calculateTotalInterest(
      approvedAmount,
      product.interest_rate,
      termMonths,
      product.interest_method,
    );
    const originationFee = Math.round(approvedAmount * product.origination_fee_rate / 100 * 100) / 100;
    const processingFee = product.processing_fee;

    await supabase.from('loans').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_amount: approvedAmount,
      principal_amount: approvedAmount,
      total_interest: totalInterest,
      total_payable: approvedAmount + totalInterest,
      origination_fee: originationFee,
      processing_fee: processingFee,
      eligibility_decision_id: decisionId,
    }).eq('id', loan.id);
  }

  // 7. Fetch updated loan
  const { data: updatedLoan } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loan.id)
    .single();

  return {
    loan: updatedLoan as Loan,
    eligibility_decision: eligibilityResult.decision,
    eligibility_factors: eligibilityResult.factors,
    eligibility_rationale: eligibilityResult.rationale,
  };
}

/**
 * Admin override of an eligibility decision.
 * Must include a reason — the override is just as auditable as the automated decision.
 */
export async function adminOverrideDecision(
  loanId: string,
  decision: 'approved' | 'denied',
  overrideReason: string,
  overrideBy: string,
  approvedAmount?: number,
): Promise<Loan> {
  const supabase = getServiceClient();

  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (!loan) throw new Error('Loan not found');

  // Log the override
  await logEligibilityDecision(
    loan.customer_id,
    loan.product_id,
    {
      decision,
      approved_amount: approvedAmount || loan.requested_amount,
      factors: [],
      credit_score: 0,
      savings_balance: 0,
      max_eligible_amount: 0,
      cooperative_status: 'not_available',
      rationale: `ADMIN OVERRIDE: ${overrideReason}`,
    },
    loan.requested_amount,
    loanId,
    'admin_override',
    overrideReason,
    overrideBy,
  );

  if (decision === 'approved') {
    const { data: updated, error } = await supabase
      .from('loans')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_amount: approvedAmount || loan.requested_amount,
        principal_amount: approvedAmount || loan.requested_amount,
      })
      .eq('id', loanId)
      .select('*')
      .single();
    if (error) throw new Error(`Failed to override: ${error.message}`);
    return updated as Loan;
  } else {
    const { data: updated, error } = await supabase
      .from('loans')
      .update({
        status: 'denied',
        denied_at: new Date().toISOString(),
      })
      .eq('id', loanId)
      .select('*')
      .single();
    if (error) throw new Error(`Failed to override: ${error.message}`);
    return updated as Loan;
  }
}

/**
 * Get a loan by ID.
 */
export async function getLoan(loanId: string): Promise<Loan | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get loan: ${error.message}`);
  return data as Loan | null;
}

/**
 * List loans for a customer.
 */
export async function listCustomerLoans(customerId: string): Promise<Loan[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list loans: ${error.message}`);
  return (data || []) as Loan[];
}

/**
 * Accept the loan agreement (mandatory before disbursement).
 */
export async function acceptAgreement(loanId: string, ipAddress?: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('loans')
    .update({
      agreement_accepted_at: new Date().toISOString(),
      agreement_accepted_ip: ipAddress || null,
    })
    .eq('id', loanId)
    .eq('status', 'approved');  // Only approved loans can accept agreement
  if (error) throw new Error(`Failed to accept agreement: ${error.message}`);
}
