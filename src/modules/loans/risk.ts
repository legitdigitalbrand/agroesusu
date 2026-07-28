// ============================================================================
// Risk Profile Management
// 
// Tracks customer risk information for the eligibility engine's feedback
// loop. When a loan defaults, the risk profile is updated, affecting
// future loan eligibility decisions.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { computeCreditScore } from './eligibility';
import type { CustomerRiskProfile } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Get or create a customer's risk profile.
 */
export async function getRiskProfile(customerId: string): Promise<CustomerRiskProfile> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from('customer_risk_profiles')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existing) return existing as CustomerRiskProfile;

  // Create default profile
  const { data: created, error } = await supabase
    .from('customer_risk_profiles')
    .insert({ customer_id: customerId })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create risk profile: ${error.message}`);
  return created as CustomerRiskProfile;
}

/**
 * Recalculate a customer's internal credit score.
 * Called after loan status changes (repayment, default, etc.)
 */
export async function recalculateCreditScore(customerId: string): Promise<number> {
  const supabase = getServiceClient();

  // Get risk profile
  const profile = await getRiskProfile(customerId);

  // Get latest savings signal
  const { data: signal } = await supabase
    .from('savings_history_signals')
    .select('tenure_score, consistency_score, stability_score')
    .eq('customer_id', customerId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const tenureScore = signal ? Number(signal.tenure_score) : 0;
  const consistencyScore = signal ? Number(signal.consistency_score) : 0;
  const stabilityScore = signal ? Number(signal.stability_score) : 0;

  const newScore = computeCreditScore(
    tenureScore,
    consistencyScore,
    stabilityScore,
    Number(profile.defaulted_loans),
    Number(profile.late_repayments),
  );

  await supabase.from('customer_risk_profiles').update({
    internal_credit_score: newScore,
  }).eq('id', profile.id);

  return newScore;
}
