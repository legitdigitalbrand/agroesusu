// ============================================================================
// Loan Repayment Processing
// 
// Customer repayments go through the Orchestrator. Each repayment is split
// into principal and interest portions — two separate Orchestrator calls
// for clean accounting:
//   - Principal: Debit Wallet, Credit Loan Receivable
//   - Interest:  Debit Wallet, Credit Interest Revenue (4001)
// 
// The repayment updates the installment record and loan totals.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { getLoan } from './aggregate';
import { getSchedule } from './schedule';
import type { RepaymentRequest, Loan, LoanStatus } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Process a loan repayment.
 * 
 * Flow:
 * 1. Find the next due/pending/partial installment
 * 2. Split the repayment into principal and interest
 * 3. Call Orchestrator for principal (loan_repayment)
 * 4. Call Orchestrator for interest (loan_interest)
 * 5. Update installment record (amount_paid, status)
 * 6. Update loan totals (total_repaid, total_interest_paid)
 * 7. Update risk profile (on_time/late repayment count)
 * 8. If all installments paid → mark loan as closed
 */
export async function repay(request: RepaymentRequest): Promise<{
  success: boolean;
  principal_reference?: string;
  interest_reference?: string;
  installment_status?: string;
  loan_status?: string;
  error?: string;
}> {
  const supabase = getServiceClient();

  try {
    // 1. Fetch the loan
    const loan = await getLoan(request.loan_id);
    if (!loan) return { success: false, error: 'Loan not found' };
    if (loan.status !== 'active' && loan.status !== 'disbursed') {
      return { success: false, error: `Loan is ${loan.status}, must be active to repay` };
    }

    // 2. Find the next installment to pay
    const schedule = await getSchedule(request.loan_id);
    const nextInstallment = schedule.find(
      (inst) => inst.status === 'pending' || inst.status === 'due' || inst.status === 'late' || inst.status === 'partial'
    );

    if (!nextInstallment) {
      return { success: false, error: 'No pending installments found — loan may be fully repaid' };
    }

    // 3. Determine amounts to pay
    const remainingPrincipal = nextInstallment.principal_amount - nextInstallment.principal_paid;
    const remainingInterest = nextInstallment.interest_amount - nextInstallment.interest_paid;
    const remainingTotal = remainingPrincipal + remainingInterest;

    // If the repayment covers the full remaining installment:
    let principalToPay: number;
    let interestToPay: number;

    if (request.amount >= remainingTotal) {
      // Full installment payment
      principalToPay = remainingPrincipal;
      interestToPay = remainingInterest;
    } else {
      // Partial payment — pay interest first, then principal (standard amortization order)
      if (request.amount >= remainingInterest) {
        interestToPay = remainingInterest;
        principalToPay = Math.round((request.amount - remainingInterest) * 100) / 100;
      } else {
        interestToPay = request.amount;
        principalToPay = 0;
      }
    }

    // 4. Look up the loan's ledger account
    const { data: ledgerAccountId } = await supabase.rpc('get_loan_account_id', {
      p_loan_id: request.loan_id,
    });

    if (!ledgerAccountId) {
      return { success: false, error: 'Loan ledger account not found' };
    }

    let principalRef: string | undefined;
    let interestRef: string | undefined;

    // 5. Post principal repayment through Orchestrator
    if (principalToPay > 0) {
      const principalResult = await initiate({
        transaction_type: 'loan_repayment',
        source_module: 'loans',
        source_reference: request.loan_id,
        amount: principalToPay,
        currency: 'NGN',
        description: `Principal repayment for ${loan.loan_number} (installment ${nextInstallment.installment_number})`,
        idempotency_key: `loan_repayment:${request.loan_id}:${nextInstallment.installment_number}:${Date.now()}`,
        wallet_id: request.wallet_id,
        product_account_id: ledgerAccountId as string,
        metadata: {
          loan_id: request.loan_id,
          installment_number: nextInstallment.installment_number,
          principal: true,
        },
      });

      if (principalResult.status === 'failed') {
        return { success: false, error: `Principal payment failed: ${principalResult.error}` };
      }
      principalRef = principalResult.transaction_reference;
    }

    // 6. Post interest payment through Orchestrator
    if (interestToPay > 0) {
      const interestResult = await initiate({
        transaction_type: 'loan_interest',
        source_module: 'loans',
        source_reference: request.loan_id,
        amount: interestToPay,
        currency: 'NGN',
        description: `Interest payment for ${loan.loan_number} (installment ${nextInstallment.installment_number})`,
        idempotency_key: `loan_interest:${request.loan_id}:${nextInstallment.installment_number}:${Date.now()}`,
        wallet_id: request.wallet_id,
        metadata: {
          loan_id: request.loan_id,
          installment_number: nextInstallment.installment_number,
          interest: true,
        },
      });

      if (interestResult.status === 'failed') {
        return { success: false, error: `Interest payment failed: ${interestResult.error}` };
      }
      interestRef = interestResult.transaction_reference;
    }

    // 7. Update installment record
    const newAmountPaid = nextInstallment.amount_paid + principalToPay + interestToPay;
    const newPrincipalPaid = nextInstallment.principal_paid + principalToPay;
    const newInterestPaid = nextInstallment.interest_paid + interestToPay;
    const totalDue = nextInstallment.principal_amount + nextInstallment.interest_amount + nextInstallment.penalty_charged;

    let installmentStatus: string;
    if (newAmountPaid >= totalDue) {
      installmentStatus = 'paid';
    } else if (newAmountPaid > 0) {
      installmentStatus = 'partial';
    } else {
      installmentStatus = nextInstallment.status;
    }

    const isOnTime = nextInstallment.status !== 'late' && new Date() <= new Date(nextInstallment.due_date);

    await supabase.from('loan_repayment_schedule').update({
      amount_paid: newAmountPaid,
      principal_paid: newPrincipalPaid,
      interest_paid: newInterestPaid,
      status: installmentStatus,
      paid_at: installmentStatus === 'paid' ? new Date().toISOString() : null,
    }).eq('id', nextInstallment.id);

    // 8. Update loan totals
    const newTotalRepaid = Number(loan.total_repaid) + principalToPay;
    const newTotalInterestPaid = Number(loan.total_interest_paid) + interestToPay;
    const totalPayable = Number(loan.total_payable) + Number(loan.total_penalty_charged);

    // Check if loan is fully repaid
    let loanStatus: LoanStatus = loan.status;
    if (newTotalRepaid + newTotalInterestPaid >= totalPayable) {
      loanStatus = 'closed';
    }

    // Find next due date (next pending installment after this one)
    const nextPending = schedule.find(
      (inst) => inst.installment_number > nextInstallment.installment_number && inst.status === 'pending'
    );

    await supabase.from('loans').update({
      total_repaid: newTotalRepaid,
      total_interest_paid: newTotalInterestPaid,
      last_repayment_at: new Date().toISOString(),
      next_due_date: nextPending ? nextPending.due_date : null,
      status: loanStatus as Loan['status'],
      ...(loanStatus === 'closed' ? { closed_at: new Date().toISOString() } : {}),
    }).eq('id', request.loan_id);

    // 9. Update risk profile
    const { data: riskProfile } = await supabase
      .from('customer_risk_profiles')
      .select('*')
      .eq('customer_id', loan.customer_id)
      .maybeSingle();

    if (riskProfile) {
      const updates: Record<string, unknown> = {
        total_repayments: Number(riskProfile.total_repayments) + 1,
      };
      if (isOnTime) {
        updates.on_time_repayments = Number(riskProfile.on_time_repayments) + 1;
      } else {
        updates.late_repayments = Number(riskProfile.late_repayments) + 1;
      }
      if (loanStatus === 'closed') {
        updates.active_loans = Math.max(0, Number(riskProfile.active_loans) - 1);
        updates.closed_loans = Number(riskProfile.closed_loans) + 1;
      }
      await supabase.from('customer_risk_profiles').update(updates).eq('id', riskProfile.id);
    }

    return {
      success: true,
      principal_reference: principalRef,
      interest_reference: interestRef,
      installment_status: installmentStatus,
      loan_status: loanStatus,
    };

  } catch (error) {
    console.error('[Loans:repay] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
