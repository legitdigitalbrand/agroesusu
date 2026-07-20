/**
 * AgroEsusu — Loan Eligibility Engine
 *
 * Determines a user's loan tier and eligible amount based on:
 * - Savings history (consistency + duration of deposits)
 * - Credit score (calculated from savings/esusu/repayment behavior)
 * - BVN/identity verification status (reuses existing verification flag)
 * - Esusu group track record (completed cycles without missed contributions)
 * - External credit check (Safe Haven credit bureau — when available, combined
 *   with in-app factors, NOT replacing them)
 *
 * This is a scoring function, not a single hard gate.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { TIER_CONFIGS, LoanTierConfig } from './config';
import { calculateCreditScore, CreditScoreBreakdown } from './credit-score';
import { getPaymentService, CreditCheckResult } from '../payment-provider';

export interface EligibilityResult {
  eligible: boolean;
  tier: LoanTierConfig | null;
  eligibleAmount: { min: number; max: number };
  reasons: string[];
  creditScore: CreditScoreBreakdown | null;
  externalCreditCheck: CreditCheckResult | null;
  blockingIssues: string[];
}

export async function checkEligibility(userId: string): Promise<EligibilityResult> {
  const admin = createAdminClient();
  const reasons: string[] = [];
  const blockingIssues: string[] = [];

  // ─── 1. BVN/Identity Verification (hard gate — reuse existing flag) ───
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    return {
      eligible: false,
      tier: null,
      eligibleAmount: { min: 0, max: 0 },
      reasons: ['Profile not found'],
      creditScore: null,
      externalCreditCheck: null,
      blockingIssues: ['No profile found'],
    };
  }

  if (profile.kyc_status !== 'verified') {
    blockingIssues.push('BVN identity verification is required before you can apply for a loan.');
  }

  // ─── 2. Check for active/overdue loans (can't apply while one is active) ───
  const { data: activeLoans } = await admin
    .from('loans')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'overdue', 'pending_review', 'approved']);

  if (activeLoans && activeLoans.length > 0) {
    blockingIssues.push('You have an active loan application or loan in progress. Complete it before applying for another.');
  }

  // ─── 3. Gather savings data ───
  const { data: accounts } = await admin
    .from('savings_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  // Months of active saving (from oldest active account)
  const now = new Date();
  let monthsSaving = 0;
  if (accounts && accounts.length > 0) {
    const oldest = accounts.reduce((min: any, acc: any) => {
      const d = new Date(acc.created_at);
      return d < min ? d : min;
    }, new Date(accounts[0].created_at));
    monthsSaving = Math.max(0, (now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth()));
  }

  // ─── 4. Esusu track record ───
  const { data: groupMemberships } = await admin
    .from('group_members')
    .select('group_id, has_received_payout, status')
    .eq('user_id', userId)
    .eq('status', 'active');

  const completedCycles = groupMemberships?.filter((m: any) => m.has_received_payout).length || 0;

  // Missed contributions
  const { count: missedContributions } = await admin
    .from('group_contributions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'late');

  // ─── 5. In-app Credit score ───
  const creditScoreBreakdown = await calculateCreditScore(userId);
  const creditScore = creditScoreBreakdown.total;

  // ─── 6. External credit check (Safe Haven — when available) ───
  let externalCreditCheck: CreditCheckResult | null = null;
  if (process.env.PAYMENT_PROVIDER === "safehaven" && profile.bvn_hash) {
    try {
      const service = await getPaymentService();
      // We need the raw BVN for the credit check, but we only stored the hash.
      // In production, we'd need to re-verify or store an encrypted version.
      // For now, skip if we don't have the raw BVN — the credit check will
      // be done during the BVN verification flow and cached.
      // TODO: Cache credit check result in DB during verification
    } catch (err) {
      console.error('External credit check failed:', err);
      // Don't block eligibility on external credit check failure
      // The in-app scoring is the primary factor
    }
  }

  // ─── 7. Prior loan history ───
  const { data: priorLoans } = await admin
    .from('loans')
    .select('id, status, overdue_days')
    .eq('user_id', userId)
    .in('status', ['completed', 'defaulted']);

  const hasPriorLoanOnTime = priorLoans?.some((l: any) => l.status === 'completed' && l.overdue_days === 0) || false;

  // ─── 8. Determine tier (highest qualifying) ───
  let qualifiedTier: LoanTierConfig | null = null;

  // Check tiers from highest to lowest
  const tierOrder: LoanTierConfig[] = [
    TIER_CONFIGS.trusted,
    TIER_CONFIGS.established,
    TIER_CONFIGS.starter,
  ];

  for (const tier of tierOrder) {
    const checks = [
      { pass: monthsSaving >= tier.minSavingMonths, label: `${tier.minSavingMonths}+ months saving` },
      { pass: completedCycles >= tier.minCompletedCycles, label: `${tier.minCompletedCycles}+ completed esusu cycles` },
      { pass: creditScore >= tier.minCreditScore, label: `Credit score ${tier.minCreditScore}+` },
      { pass: !tier.requiresPriorLoan || hasPriorLoanOnTime, label: 'Prior loan repaid on time' },
      { pass: (missedContributions || 0) === 0, label: 'No missed esusu contributions' },
    ];

    // External credit check can boost or restrict tier (not a hard gate)
    const extCredit: CreditCheckResult | null = externalCreditCheck as CreditCheckResult | null;
    if (extCredit !== null && extCredit.status !== "no_data") {
      if (extCredit.status === 'poor') {
        // Poor external credit restricts to starter tier max
        if (tier.tier !== 'starter') {
          continue;
        }
      }
    }

    const allPassed = checks.every(c => c.pass);
    if (allPassed) {
      qualifiedTier = tier;
      reasons.push(`Qualifies for ${tier.label} tier: ${checks.map(c => c.label).join(', ')}`);
      const extCredit: CreditCheckResult | null = externalCreditCheck as CreditCheckResult | null;
    if (extCredit !== null && extCredit.status !== "no_data") {
        reasons.push(`External credit check: ${extCredit.status} (score: ${extCredit.score})`);
      }
      break;
    }
  }

  // If no tier qualifies, give helpful feedback
  if (!qualifiedTier) {
    if (monthsSaving < 1) {
      reasons.push('Start saving in a pot to build eligibility — at least 1 month of active saving is needed.');
    }
    if (completedCycles < 1 && monthsSaving >= 1) {
      reasons.push('Join an esusu group and complete a cycle to unlock higher loan tiers.');
    }
    if ((missedContributions || 0) > 0) {
      reasons.push('You have missed esusu contributions — clear them to improve eligibility.');
    }
    // Still check if they at least qualify for starter with relaxed criteria
    const starterRelaxed =
      profile.kyc_status === 'verified' &&
      monthsSaving >= 1;
    if (starterRelaxed) {
      qualifiedTier = TIER_CONFIGS.starter;
      reasons.push('Qualifies for Starter tier (relaxed): BVN verified + 1+ month saving.');
    }
  }

  // ─── 9. Final determination ───
  const hasBlockingIssues = blockingIssues.length > 0;
  const eligible = !hasBlockingIssues && qualifiedTier !== null;

  return {
    eligible,
    tier: qualifiedTier,
    eligibleAmount: qualifiedTier
      ? { min: qualifiedTier.minAmount, max: qualifiedTier.maxAmount }
      : { min: 0, max: 0 },
    reasons,
    creditScore: creditScoreBreakdown,
    externalCreditCheck,
    blockingIssues,
  };
}
