// ============================================================================
// Savings Goals (Pot Metadata) Management
//
// Extends the savings engine with goal-specific metadata for Savings Pots.
// Balance remains the source of truth in savings_accounts. Progress is
// calculated dynamically from balance / target_amount.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface SavingsGoal {
  goal_id: string;
  account_id: string;
  pot_name: string;
  target_amount: number;
  target_date: string | null;
  monthly_target: number | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface CreateGoalRequest {
  account_id: string;
  pot_name: string;
  target_amount: number;
  target_date?: string | null;
  monthly_target?: number | null;
}

export interface UpdateGoalRequest {
  pot_name?: string;
  target_amount?: number;
  target_date?: string | null;
  monthly_target?: number | null;
  status?: 'active' | 'archived';
}

/** Create a savings goal linked to a savings account */
export async function createGoal(request: CreateGoalRequest): Promise<SavingsGoal> {
  const supabase = getServiceClient();

  if (!request.pot_name || request.pot_name.trim().length === 0) {
    throw new Error('Pot name is required');
  }
  if (request.pot_name.length > 50) {
    throw new Error('Pot name must be 50 characters or fewer');
  }
  if (!request.target_amount || request.target_amount <= 0) {
    throw new Error('Target amount must be greater than zero');
  }

  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      account_id: request.account_id,
      pot_name: request.pot_name.trim(),
      target_amount: request.target_amount,
      target_date: request.target_date || null,
      monthly_target: request.monthly_target || null,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create savings goal: ${error.message}`);
  return data as SavingsGoal;
}

/** Get the active goal for a savings account (if any) */
export async function getGoalByAccountId(accountId: string): Promise<SavingsGoal | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(`Failed to get savings goal: ${error.message}`);
  return data as SavingsGoal | null;
}

/** Get goals for multiple account IDs (for batch enrichment) */
export async function getGoalsForAccounts(accountIds: string[]): Promise<Map<string, SavingsGoal>> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .in('account_id', accountIds)
    .eq('status', 'active');

  if (error) throw new Error(`Failed to get savings goals: ${error.message}`);
  const map = new Map<string, SavingsGoal>();
  for (const goal of (data || []) as SavingsGoal[]) {
    map.set(goal.account_id, goal);
  }
  return map;
}

/** Update a savings goal (rename, edit target, etc.) */
export async function updateGoal(goalId: string, updates: UpdateGoalRequest): Promise<SavingsGoal> {
  const supabase = getServiceClient();

  const updateData: Record<string, unknown> = {};
  if (updates.pot_name !== undefined) {
    if (updates.pot_name.trim().length === 0) throw new Error('Pot name cannot be empty');
    if (updates.pot_name.length > 50) throw new Error('Pot name must be 50 characters or fewer');
    updateData.pot_name = updates.pot_name.trim();
  }
  if (updates.target_amount !== undefined) {
    if (updates.target_amount <= 0) throw new Error('Target amount must be greater than zero');
    updateData.target_amount = updates.target_amount;
  }
  if (updates.target_date !== undefined) {
    updateData.target_date = updates.target_date || null;
  }
  if (updates.monthly_target !== undefined) {
    if (updates.monthly_target !== null && updates.monthly_target <= 0) {
      throw new Error('Monthly target must be greater than zero');
    }
    updateData.monthly_target = updates.monthly_target || null;
  }
  if (updates.status !== undefined) {
    updateData.status = updates.status;
  }

  const { data, error } = await supabase
    .from('savings_goals')
    .update(updateData)
    .eq('goal_id', goalId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update savings goal: ${error.message}`);
  return data as SavingsGoal;
}

/** Archive a savings goal (hide from dashboard, keep in history) */
export async function archiveGoal(goalId: string): Promise<SavingsGoal> {
  return updateGoal(goalId, { status: 'archived' });
}

/** Calculate progress percentage (capped at 100) */
export function calculateProgress(balance: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0;
  const pct = (balance / targetAmount) * 100;
  return Math.min(100, Math.round(pct * 10) / 10); // 1 decimal place, capped at 100
}

/** Get milestone message based on progress percentage */
export function getMilestone(progressPct: number): { emoji: string; label: string } | null {
  if (progressPct >= 100) return { emoji: '🎉', label: 'Goal Achieved' };
  if (progressPct >= 75) return { emoji: '🌳', label: 'Almost There' };
  if (progressPct >= 50) return { emoji: '🌿', label: 'Great Progress' };
  if (progressPct >= 25) return { emoji: '🌱', label: 'Getting Started' };
  return null;
}

/** Get motivational insight based on progress and monthly target */
export function getInsight(progressPct: number, balance: number, target: number, monthlyTarget: number | null): string | null {
  const remaining = target - balance;
  if (remaining <= 0) return null;

  if (progressPct >= 100) return null;

  if (monthlyTarget && monthlyTarget > 0) {
    if (progressPct >= 90) return 'One more deposit completes this goal.';
    if (monthlyTarget <= remaining) {
      return `Deposit ₦${monthlyTarget.toLocaleString('en-NG')} this month to stay on track.`;
    }
    return 'You are ahead of schedule.';
  }

  return null;
}
