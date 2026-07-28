// ============================================================================
// Collections & Default Handling
// 
// Scheduled job that:
//   1. Checks all active loans for overdue installments
//   2. Marks installments as 'late' if past due date (+ grace period)
//   3. Applies configurable penalties (financial transaction through Orchestrator)
//   4. Counts consecutive missed installments
//   5. Transitions loan to 'defaulted' if threshold reached
//   6. Updates customer risk profile on default
// 
// Defaults are a STATE, not a deletion. The loan record and all its
// history remain fully traceable.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import type { Loan, Installment } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface CollectionResult {
  loans_checked: number;
  installments_late: number;
  penalties_applied: number;
  loans_defaulted: number;
  details: Array<{
    loan_id: string;
    loan_number: string;
    action: string;
  }>;
}

/**
 * Run the collections check for all active loans.
 * Called by Vercel cron (daily at 6 AM).
 */
export async function runCollectionsCheck(): Promise<CollectionResult> {
  const supabase = getServiceClient();
  const now = new Date();
  const details: CollectionResult['details'] = [];
  let installmentsLate = 0;
  let penaltiesApplied = 0;
  let loansDefaulted = 0;

  // 1. Get all active loans
  const { data: activeLoans, error } = await supabase
    .from('loans')
    .select('*')
    .in('status', ['active', 'disbursed']);

  if (error) throw new Error(`Failed to fetch active loans: ${error.message}`);

  for (const loan of (activeLoans || [])) {
    // 2. Get the loan's repayment schedule
    const { data: installments } = await supabase
      .from('loan_repayment_schedule')
      .select('*')
      .eq('loan_id', loan.id)
      .order('installment_number', { ascending: true });

    if (!installments) continue;

    const terms = loan.product_terms_snapshot as {
      late_payment_penalty_rate: number;
      grace_period_days: number;
      max_missed_installments: number;
    };

    let consecutiveMissed = 0;

    for (const inst of installments) {
      const installment = inst as Installment;

      // Skip paid installments
      if (installment.status === 'paid' || installment.status === 'defaulted') {
        continue;
      }

      const dueDate = new Date(installment.due_date);
      const graceEndDate = new Date(dueDate);
      graceEndDate.setDate(graceEndDate.getDate() + (terms.grace_period_days || 0));

      // Check if past due + grace period
      if (now > graceEndDate && installment.status === 'pending') {
        // Mark as late
        const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        await supabase.from('loan_repayment_schedule').update({
          status: 'late',
          days_late: daysLate,
        }).eq('id', installment.id);

        installmentsLate++;
        consecutiveMissed++;
        details.push({ loan_id: loan.id, loan_number: loan.loan_number, action: `Installment ${installment.installment_number} marked late (${daysLate} days)` });

        // Apply penalty if configured
        if (terms.late_payment_penalty_rate > 0) {
          const weeksLate = Math.ceil(daysLate / 7);
          const penaltyAmount = Math.round(
            (installment.total_amount * terms.late_payment_penalty_rate / 100 * weeksLate) * 100
          ) / 100;

          if (penaltyAmount > 0) {
            // Post penalty through Orchestrator
            const { data: ledgerAccountId } = await supabase.rpc('get_loan_account_id', {
              p_loan_id: loan.id,
            });

            if (ledgerAccountId) {
              const penaltyResult = await initiate({
                transaction_type: 'loan_penalty',
                source_module: 'loans',
                source_reference: loan.id,
                amount: penaltyAmount,
                currency: 'NGN',
                description: `Late payment penalty for ${loan.loan_number} (installment ${installment.installment_number}, ${daysLate} days late)`,
                idempotency_key: `loan_penalty:${loan.id}:${installment.installment_number}:${now.toISOString().split('T')[0]}`,
                product_account_id: ledgerAccountId as string,
                metadata: {
                  loan_id: loan.id,
                  installment_number: installment.installment_number,
                  days_late: daysLate,
                },
              });

              if (penaltyResult.status === 'completed') {
                // Update installment with penalty
                await supabase.from('loan_repayment_schedule').update({
                  penalty_charged: Number(installment.penalty_charged) + penaltyAmount,
                }).eq('id', installment.id);

                // Update loan total penalty
                await supabase.from('loans').update({
                  total_penalty_charged: Number(loan.total_penalty_charged) + penaltyAmount,
                }).eq('id', loan.id);

                penaltiesApplied++;
                details.push({ loan_id: loan.id, loan_number: loan.loan_number, action: `Penalty ₦${penaltyAmount} applied (installment ${installment.installment_number})` });
              }
            }
          }
        }
      } else if (installment.status === 'late') {
        // Already late — count as missed
        consecutiveMissed++;
      }
    }

    // 3. Check if loan should be defaulted
    if (consecutiveMissed >= (terms.max_missed_installments || 3)) {
      await supabase.from('loans').update({
        status: 'defaulted',
        defaulted_at: new Date().toISOString(),
      }).eq('id', loan.id);

      // Mark remaining installments as defaulted
      await supabase.from('loan_repayment_schedule').update({
        status: 'defaulted',
      }).eq('loan_id', loan.id).in('status', ['pending', 'late', 'due', 'partial']);

      // Update risk profile
      const { data: riskProfile } = await supabase
        .from('customer_risk_profiles')
        .select('*')
        .eq('customer_id', loan.customer_id)
        .maybeSingle();

      if (riskProfile) {
        const newDefaultedLoans = Number(riskProfile.defaulted_loans) + 1;
        const newActiveLoans = Math.max(0, Number(riskProfile.active_loans) - 1);
        const newRiskLevel = newDefaultedLoans >= 2 ? 'restricted' : 'high';

        await supabase.from('customer_risk_profiles').update({
          defaulted_loans: newDefaultedLoans,
          active_loans: newActiveLoans,
          risk_level: newRiskLevel,
          last_default_date: new Date().toISOString(),
          last_default_loan_id: loan.id,
        }).eq('id', riskProfile.id);
      } else {
        await supabase.from('customer_risk_profiles').insert({
          customer_id: loan.customer_id,
          risk_level: 'high',
          defaulted_loans: 1,
          active_loans: 0,
          last_default_date: new Date().toISOString(),
          last_default_loan_id: loan.id,
        });
      }

      loansDefaulted++;
      details.push({ loan_id: loan.id, loan_number: loan.loan_number, action: `LOAN DEFAULTED (${consecutiveMissed} consecutive missed installments)` });
    }
  }

  return {
    loans_checked: (activeLoans || []).length,
    installments_late: installmentsLate,
    penalties_applied: penaltiesApplied,
    loans_defaulted: loansDefaulted,
    details,
  };
}
