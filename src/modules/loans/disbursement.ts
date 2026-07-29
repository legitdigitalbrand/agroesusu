// ============================================================================
// Loan Disbursement Flow
// 
// Moves funds from the loan receivable account to the customer's wallet
// through the Orchestrator. Generates the repayment schedule after
// disbursement.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { generateSchedule } from './schedule';
import { getLoan } from './aggregate';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Disburse an approved loan.
 * 
 * Prerequisites:
 *   - Loan status must be 'approved'
 *   - Agreement must be accepted
 * 
 * Flow:
 *   1. Validate prerequisites
 *   2. Look up the loan's ledger account (auto-created by trigger)
 *   3. Call Orchestrator with loan_disbursement type
 *      → Debit Loan Receivable (1002.{loan}), Credit Wallet (2000.{wallet})
 *   4. Update loan status to 'disbursed'/'active'
 *   5. Generate repayment schedule
 *   6. Update risk profile (active_loans count)
 */
export async function disburseLoan(loanId: string): Promise<{
  success: boolean;
  transaction_reference?: string;
  schedule?: unknown[];
  error?: string;
}> {
  const supabase = getServiceClient();

  try {
    // 1. Fetch the loan
    const loan = await getLoan(loanId);
    if (!loan) return { success: false, error: 'Loan not found' };

    if (loan.status !== 'approved') {
      return { success: false, error: `Loan status is ${loan.status}, must be 'approved' to disburse` };
    }

    if (!loan.agreement_accepted_at) {
      return { success: false, error: 'Loan agreement must be accepted before disbursement' };
    }

    if (!loan.approved_amount || loan.approved_amount <= 0) {
      return { success: false, error: 'No approved amount set' };
    }

    // 2. Look up the loan's ledger account
    // The trigger creates this when status transitions to disbursed/active,
    // but we need it BEFORE the disbursement. So we'll create it manually
    // if it doesn't exist yet.
    const { data: ledgerAccountId } = await supabase.rpc('get_loan_account_id', {
      p_loan_id: loanId,
    });

    let productAccountId = ledgerAccountId as string | null;

    if (!productAccountId) {
      // Create the ledger account manually (trigger will fire on status update,
      // but we need it now for the Orchestrator call)
      const { data: parentAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('account_code', '1002')
        .single();

      if (!parentAccount) return { success: false, error: 'Loan receivables parent account (1002) not found' };

      const accountCode = `1002.${loan.loan_number}`;
      const { data: newAccount, error: acctError } = await supabase
        .from('accounts')
        .insert({
          account_code: accountCode,
          account_type: 'asset',
          account_category: 'other',
          name: `Loan: ${loan.loan_number}`,
          description: `Loan receivable for ${loan.loan_number}`,
          parent_account_id: parentAccount.id,
          is_system_account: false,
          is_active: true,
          metadata: {
            loan_id: loanId,
            customer_id: loan.customer_id,
            product_id: loan.product_id,
          },
        })
        .select('id')
        .single();

      if (acctError || !newAccount) {
        return { success: false, error: `Failed to create loan ledger account: ${acctError?.message}` };
      }
      productAccountId = newAccount.id;
    }

    // 3. Call the Orchestrator
    const result = await initiate({
      transaction_type: 'loan_disbursement',
      source_module: 'loans',
      source_reference: loanId,
      amount: loan.approved_amount,
      currency: 'NGN',
      description: `Loan disbursement for ${loan.loan_number}`,
      idempotency_key: `loan_disbursement:${loanId}`,
      wallet_id: loan.wallet_id,
      product_account_id: productAccountId ?? undefined,
      metadata: {
        loan_id: loanId,
        product_id: loan.product_id,
      },
    });

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Orchestrator failed to disburse' };
    }

    // 4. Update loan status
    const firstDueDate = new Date();
    firstDueDate.setMonth(firstDueDate.getMonth() + 1);

    await supabase.from('loans').update({
      status: 'active',
      disbursed_at: new Date().toISOString(),
      disbursement_ft_id: result.id,
      next_due_date: firstDueDate.toISOString(),
    }).eq('id', loanId);

    // 5. Generate repayment schedule
    const schedule = await generateSchedule(
      loanId,
      loan.approved_amount,
      loan.interest_rate,
      loan.term_months,
      loan.interest_method as "flat" | "reducing_balance",
      new Date(),
    );

    // 6. Update risk profile (increment active_loans)
    const { data: riskProfile } = await supabase
      .from('customer_risk_profiles')
      .select('id, total_loans, active_loans')
      .eq('customer_id', loan.customer_id)
      .maybeSingle();

    if (riskProfile) {
      await supabase.from('customer_risk_profiles').update({
        total_loans: Number(riskProfile.total_loans) + 1,
        active_loans: Number(riskProfile.active_loans) + 1,
      }).eq('id', riskProfile.id);
    } else {
      await supabase.from('customer_risk_profiles').insert({
        customer_id: loan.customer_id,
        total_loans: 1,
        active_loans: 1,
      });
    }

    return {
      success: true,
      transaction_reference: result.transaction_reference,
      schedule,
    };

  } catch (error) {
    console.error('[Loans:disburse] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
