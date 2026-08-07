// ============================================================================
// Savings Goals Management
//
// Goal metadata lives directly on savings_accounts:
//   - pot_name       → nickname
//   - target_amount  → goal amount
//   - goal_enabled   → whether progress tracking is active
//   - goal_date      → optional target date
//   - monthly_target → optional monthly contribution target
//
// Balance remains the source of truth in the ledger. Progress is calculated
// dynamically from balance / target_amount.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface SavingsGoal {
  account_id: string;
  pot_name: string;
  target_amount: number;
  target_date: string | null;
  monthly_target: number | null;
  goal_enabled: boolean;
  status: 'active' | 'archived';
}

/** Create a savings goal by updating the savings account with goal metadata */
export async function createGoal(request: {
  account_id: string;
  pot_name: string;
  target_amount: number;
  target_date?: string | null;
  monthly_target?: number | null;
}): Promise<SavingsGoal> {
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
    .from('savings_accounts')
    .update({
      goal_enabled: true,
      pot_name: request.pot_name.trim(),
      target_amount: request.target_amount,
      goal_date: request.target_date || null,
      monthly_target: request.monthly_target || null,
    })
    .eq('id', request.account_id)
    .select('id, pot_name, target_amount, goal_date, monthly_target, goal_enabled, status')
    .single();

  if (error) throw new Error(`Failed to create savings goal: ${error.message}`);

  const row = data as Record<string, unknown>;
  return {
    account_id: row.id as string,
    pot_name: row.pot_name as string,
    target_amount: row.target_amount as number,
    target_date: (row.goal_date as string) || null,
    monthly_target: (row.monthly_target as number) || null,
    goal_enabled: (row.goal_enabled as boolean) || true,
    status: 'active',
  };
}

/** Get the goal metadata for a savings account */
export async function getGoalByAccountId(accountId: string): Promise<SavingsGoal | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_accounts')
    .select('id, pot_name, target_amount, goal_date, monthly_target, goal_enabled, status')
    .eq('id', accountId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get savings goal: ${error.message}`);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  if (!row.goal_enabled) return null;

  return {
    account_id: row.id as string,
    pot_name: row.pot_name as string,
    target_amount: row.target_amount as number,
    target_date: (row.goal_date as string) || null,
    monthly_target: (row.monthly_target as number) || null,
    goal_enabled: true,
    status: (row.status as string) === 'closed' ? 'archived' : 'active',
  };
}

/** Get goals for multiple account IDs (for batch enrichment) */
export async function getGoalsForAccounts(accountIds: string[]): Promise<Map<string, SavingsGoal>> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_accounts')
    .select('id, pot_name, target_amount, goal_date, monthly_target, goal_enabled, status')
    .in('id', accountIds)
    .eq('goal_enabled', true);

  if (error) throw new Error(`Failed to get savings goals: ${error.message}`);
  const map = new Map<string, SavingsGoal>();
  for (const row of (data || []) as Record<string, unknown>[]) {
    map.set(row.id as string, {
      account_id: row.id as string,
      pot_name: row.pot_name as string,
      target_amount: row.target_amount as number,
      target_date: (row.goal_date as string) || null,
      monthly_target: (row.monthly_target as number) || null,
      goal_enabled: true,
      status: (row.status as string) === 'closed' ? 'archived' : 'active',
    });
  }
  return map;
}

/** Update a savings goal (rename, edit target, etc.) */
export async function updateGoal(
  accountId: string,
  updates: {
    pot_name?: string;
    target_amount?: number;
    target_date?: string | null;
    monthly_target?: number | null;
    status?: 'active' | 'archived';
  }
): Promise<SavingsGoal> {
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
    updateData.goal_date = updates.target_date || null;
  }
  if (updates.monthly_target !== undefined) {
    if (updates.monthly_target !== null && updates.monthly_target <= 0) {
      throw new Error('Monthly target must be greater than zero');
    }
    updateData.monthly_target = updates.monthly_target || null;
  }
  if (updates.status !== undefined) {
    if (updates.status === 'archived') {
      updateData.status = 'closed';
      updateData.goal_enabled = false;
      updateData.closed_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('savings_accounts')
    .update(updateData)
    .eq('id', accountId)
    .select('id, pot_name, target_amount, goal_date, monthly_target, goal_enabled, status')
    .single();

  if (error) throw new Error(`Failed to update savings goal: ${error.message}`);

  const row = data as Record<string, unknown>;
  return {
    account_id: row.id as string,
    pot_name: row.pot_name as string,
    target_amount: row.target_amount as number,
    target_date: (row.goal_date as string) || null,
    monthly_target: (row.monthly_target as number) || null,
    goal_enabled: (row.goal_enabled as boolean) || false,
    status: (row.status as string) === 'closed' ? 'archived' : 'active',
  };
}

/** Archive a savings goal (close the account, keep history) */
export async function archiveGoal(accountId: string): Promise<SavingsGoal> {
  return updateGoal(accountId, { status: 'archived' });
}

/** Calculate progress percentage (capped at 100) */
export function calculateProgress(balance: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0;
  const pct = (balance / targetAmount) * 100;
  return Math.min(100, Math.round(pct * 10) / 10);
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
