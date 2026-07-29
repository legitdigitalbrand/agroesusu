// ============================================================================
// Repayment Schedule Generation
// 
// Generates installment records from product terms. Supports both flat
// and reducing balance interest methods.
// 
// Flat: Each installment = (principal + total_interest) / num_installments
// Reducing balance: Amortized — equal installments, interest decreases over time
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { Installment } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Calculate total interest for a loan.
 */
export function calculateTotalInterest(
  principal: number,
  annualRate: number,
  termMonths: number,
  method: 'flat' | 'reducing_balance'
): number {
  if (method === 'flat') {
    // Simple interest: P × R × T
    return (principal * (annualRate / 100) * termMonths) / 12;
  }

  // Reducing balance: total interest = (installment × num_payments) - principal
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return 0;
  const installment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round((installment * termMonths - principal) * 100) / 100;
}

/**
 * Generate and store a repayment schedule for a loan.
 */
export async function generateSchedule(
  loanId: string,
  principal: number,
  annualRate: number,
  termMonths: number,
  method: 'flat' | 'reducing_balance',
  startDate: Date = new Date(),
): Promise<Installment[]> {
  const supabase = getServiceClient();

  const totalInterest = calculateTotalInterest(principal, annualRate, termMonths, method);
  const totalPayable = principal + totalInterest;

  const installments: Array<{
    loan_id: string;
    installment_number: number;
    due_date: string;
    principal_amount: number;
    interest_amount: number;
    total_amount: number;
  }> = [];

  if (method === 'flat') {
    // Equal installments: each = totalPayable / termMonths
    const installmentTotal = Math.round((totalPayable / termMonths) * 100) / 100;
    const installmentPrincipal = Math.round((principal / termMonths) * 100) / 100;
    const installmentInterest = Math.round((totalInterest / termMonths) * 100) / 100;

    for (let i = 1; i <= termMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      // Adjust for the last installment to account for rounding
      const isLast = i === termMonths;
      installments.push({
        loan_id: loanId,
        installment_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        principal_amount: isLast ? Math.round((principal - installmentPrincipal * (termMonths - 1)) * 100) / 100 : installmentPrincipal,
        interest_amount: isLast ? Math.round((totalInterest - installmentInterest * (termMonths - 1)) * 100) / 100 : installmentInterest,
        total_amount: isLast ? Math.round((totalPayable - installmentTotal * (termMonths - 1)) * 100) / 100 : installmentTotal,
      });
    }
  } else {
    // Reducing balance: amortized
    const monthlyRate = annualRate / 100 / 12;
    const installment = monthlyRate === 0
      ? principal / termMonths
      : principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);

    let remainingPrincipal = principal;

    for (let i = 1; i <= termMonths; i++) {
      const interestPortion = Math.round(remainingPrincipal * monthlyRate * 100) / 100;
      const principalPortion = Math.round((installment - interestPortion) * 100) / 100;
      remainingPrincipal = Math.round((remainingPrincipal - principalPortion) * 100) / 100;

      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      // Last installment: adjust for rounding
      const isLast = i === termMonths;
      installments.push({
        loan_id: loanId,
        installment_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        principal_amount: isLast ? Math.round((principalPortion + remainingPrincipal) * 100) / 100 : principalPortion,
        interest_amount: interestPortion,
        total_amount: isLast ? Math.round((principalPortion + remainingPrincipal + interestPortion) * 100) / 100 : Math.round(installment * 100) / 100,
      });
    }
  }

  const { data, error } = await supabase
    .from('loan_repayment_schedule')
    .insert(installments)
    .select('*')
    .order('installment_number', { ascending: true });

  if (error) throw new Error(`Failed to generate schedule: ${error.message}`);
  return (data || []) as Installment[];
}

/**
 * Get the repayment schedule for a loan.
 */
export async function getSchedule(loanId: string): Promise<Installment[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('loan_repayment_schedule')
    .select('*')
    .eq('loan_id', loanId)
    .order('installment_number', { ascending: true });
  if (error) throw new Error(`Failed to get schedule: ${error.message}`);
  return (data || []) as Installment[];
}
