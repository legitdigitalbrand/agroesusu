/**
 * AgroEsusu — Credit Score Calculation Engine
 *
 * Makes the existing `credit_score` field on Profile meaningful.
 * Formula combines:
 * - Savings consistency (duration + frequency of deposits)
 * - Savings volume (total amount saved)
 * - Esusu completion (completed cycles without missed contributions)
 * - Repayment history (on-time repayment of past loans)
 *
 * Score range: 300 (base) to 850 (max), mirroring standard credit score ranges.
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  CREDIT_SCORE_WEIGHTS,
  BASE_CREDIT_SCORE,
  MAX_CREDIT_SCORE,
} from './config';

export interface CreditScoreBreakdown {
  total: number;
  savingsConsistency: number;
  savingsVolume: number;
  esusuCompletion: number;
  repaymentHistory: number;
  factors: {
    monthsSaving: number;
    totalSaved: number;
    completedCycles: number;
    missedContributions: number;
    loansTaken: number;
    loansOnTime: number;
    activeLoans: number;
  };
}

/**
 * Calculate and return a full credit score breakdown for a user.
 * Reads from savings_accounts, group_members, group_contributions, loans, and loan_installments.
 */
export async function calculateCreditScore(userId: string): Promise<CreditScoreBreakdown> {
  const admin = createAdminClient();

  // ─── Fetch accounts, profile, group data in parallel ───
  const [
    { data: accounts },
    { data: profile },
    { data: groupMemberships },
    { count: missedContributions },
  ] = await Promise.all([
    admin.from('savings_accounts').select('*').eq('user_id', userId),
    admin.from('profiles').select('total_saved, created_at').eq('id', userId).single(),
    admin.from('group_members')
      .select('group_id, has_received_payout, reliability_rating')
      .eq('user_id', userId)
      .eq('status', 'active'),
    admin.from('group_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'late'),
  ]);

  // ─── Fetch loans (needed before installments) ───
  const { data: loans } = await admin.from('loans').select('*').eq('user_id', userId);

  // ─── Fetch installments for those loans ───
  const loanIds = (loans || []).map((l: any) => l.id);
  let installments: any[] = [];
  if (loanIds.length > 0) {
    const { data: instData } = await admin
      .from('loan_installments')
      .select('*')
      .in('loan_id', loanIds);
    installments = instData || [];
  }

  // ─── Savings Consistency (0-100 component, weighted 30%) ───
  const now = new Date();
  let monthsSaving = 0;
  if (accounts && accounts.length > 0) {
    const oldestAccount = accounts.reduce((oldest: Date, acc: any) => {
      const accDate = new Date(acc.created_at);
      return accDate < oldest ? accDate : oldest;
    }, new Date(accounts[0].created_at));
    monthsSaving = Math.max(0, (now.getFullYear() - oldestAccount.getFullYear()) * 12 + (now.getMonth() - oldestAccount.getMonth()));
  }

  const completedGoals = accounts?.filter((a: any) => a.status === 'completed').length || 0;
  const savingsConsistencyScore = Math.min(100,
    (monthsSaving / 6) * 60 +
    (completedGoals > 0 ? 20 : 0) +
    (accounts && accounts.length >= 2 ? 20 : 0)
  );

  // ─── Savings Volume (0-100, weighted 20%) ───
  const totalSaved = Number(profile?.total_saved || 0);
  const savingsVolumeScore = Math.min(100, (totalSaved / 500000) * 100);

  // ─── Esusu Completion (0-100, weighted 20%) ───
  const completedCycles = groupMemberships?.filter((m: any) => m.has_received_payout).length || 0;
  const reliabilityAvg = groupMemberships && groupMemberships.length > 0
    ? groupMemberships.reduce((sum: number, m: any) => sum + (m.reliability_rating || 100), 0) / groupMemberships.length
    : 100;
  const missedCount = missedContributions || 0;

  const esusuCompletionScore = Math.min(100,
    (completedCycles / 2) * 60 +
    (reliabilityAvg / 100) * 20 +
    (missedCount === 0 ? 20 : Math.max(0, 20 - missedCount * 5))
  );

  // ─── Repayment History (0-100, weighted 30%) ───
  const userLoans: any[] = loans || [];
  const loansTaken = userLoans.length;
  const completedLoans = userLoans.filter((l: any) => l.status === 'completed');
  const loansOnTime = completedLoans.filter((l: any) => l.overdue_days === 0).length;
  const activeLoans = userLoans.filter((l: any) => ['active', 'overdue'].includes(l.status)).length;

  let repaymentHistoryScore: number;
  if (loansTaken === 0) {
    repaymentHistoryScore = 50;
  } else {
    const onTimeRate = loansTaken > 0 ? loansOnTime / loansTaken : 0;
    repaymentHistoryScore = Math.min(100,
      onTimeRate * 70 +
      (completedLoans.length / loansTaken) * 30
    );
  }

  // ─── Final Weighted Score ───
  const weightedTotal =
    savingsConsistencyScore * CREDIT_SCORE_WEIGHTS.savingsConsistency +
    savingsVolumeScore * CREDIT_SCORE_WEIGHTS.savingsVolume +
    esusuCompletionScore * CREDIT_SCORE_WEIGHTS.esusuCompletion +
    repaymentHistoryScore * CREDIT_SCORE_WEIGHTS.repaymentHistory;

  const total = Math.round(BASE_CREDIT_SCORE + (weightedTotal / 100) * (MAX_CREDIT_SCORE - BASE_CREDIT_SCORE));
  const clampedTotal = Math.min(MAX_CREDIT_SCORE, Math.max(BASE_CREDIT_SCORE, total));

  return {
    total: clampedTotal,
    savingsConsistency: Math.round(savingsConsistencyScore),
    savingsVolume: Math.round(savingsVolumeScore),
    esusuCompletion: Math.round(esusuCompletionScore),
    repaymentHistory: Math.round(repaymentHistoryScore),
    factors: {
      monthsSaving,
      totalSaved,
      completedCycles,
      missedContributions: missedCount,
      loansTaken,
      loansOnTime,
      activeLoans,
    },
  };
}

/**
 * Recalculate and persist the credit score to the user's profile.
 * Call this after: deposits, group cycle completion, loan repayment, missed payment.
 */
export async function updateCreditScore(userId: string): Promise<number> {
  const breakdown = await calculateCreditScore(userId);
  const admin = createAdminClient();

  await admin
    .from('profiles')
    .update({ credit_score: breakdown.total })
    .eq('id', userId);

  return breakdown.total;
}
