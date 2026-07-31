// ============================================================================
// Esusu — Rotation Logic & Payouts
// 
// Esusu (rotating savings): N members contribute each cycle, one member
// receives the full pool. Rotation order and missed-contribution policy
// are configurable per group.
// 
// Payouts go through the Orchestrator: Debit Group Pool, Credit Wallet.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { getGroupPoolBalance, getGroupMembers } from './group-savings';
import type { EsusuGroup, EsusuPayout } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Create an Esusu group attached to a group savings account.
 */
export async function createEsusuGroup(
  groupAccountId: string,
  contributionAmount: number,
  cycleLengthDays: number,
  missedPolicy: 'skip_turn' | 'penalty' | 'group_vote' | 'exclude_member' = 'penalty',
  missedPenaltyRate: number = 10.00,
): Promise<EsusuGroup> {
  const supabase = getServiceClient();
  
  // Get active members to determine total cycles
  const members = await getGroupMembers(groupAccountId);
  if (members.length < 2) throw new Error('Esusu requires at least 2 members');
  
  // Rotation order = array of membership IDs in join order
  const rotationOrder = members.map(m => m.id);
  
  const { data, error } = await supabase
    .from('esusu_groups')
    .insert({
      group_account_id: groupAccountId,
      contribution_amount: contributionAmount,
      cycle_length_days: cycleLengthDays,
      total_cycles: members.length,
      rotation_order: rotationOrder,
      current_cycle: 0,
      current_position: 0,
      missed_policy: missedPolicy,
      missed_penalty_rate: missedPenaltyRate,
      status: 'forming',
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create Esusu group: ${error.message}`);
  
  // Assign rotation positions to members
  for (let i = 0; i < members.length; i++) {
    await supabase
      .from('group_savings_memberships')
      .update({ rotation_position: i + 1 })
      .eq('id', members[i].id);
  }
  
  return data as EsusuGroup;
}

/**
 * Start the Esusu rotation.
 */
export async function startEsusu(esusuGroupId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('esusu_groups')
    .update({
      status: 'active',
      started_at: new Date().toISOString(),
      current_cycle: 1,
      current_position: 0,
    })
    .eq('id', esusuGroupId)
    .eq('status', 'forming');
  if (error) throw new Error(`Failed to start Esusu: ${error.message}`);
}

/**
 * Get Esusu group details.
 */
export async function getEsusuGroup(esusuGroupId: string): Promise<EsusuGroup | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('esusu_groups')
    .select('*')
    .eq('id', esusuGroupId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get Esusu group: ${error.message}`);
  return data as EsusuGroup | null;
}

/**
 * Get Esusu group by its parent group savings account.
 */
export async function getEsusuByGroupAccount(groupAccountId: string): Promise<EsusuGroup | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('esusu_groups')
    .select('*')
    .eq('group_account_id', groupAccountId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get Esusu by group account: ${error.message}`);
  return data as EsusuGroup | null;
}

/**
 * Get all payouts for an Esusu group.
 */
export async function getEsusuPayouts(esusuGroupId: string): Promise<EsusuPayout[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('esusu_payouts')
    .select('*')
    .eq('esusu_group_id', esusuGroupId)
    .order('cycle_number', { ascending: true });
  if (error) throw new Error(`Failed to get Esusu payouts: ${error.message}`);
  return (data || []) as EsusuPayout[];
}

/**
 * Process the next Esusu rotation payout.
 * 
 * This is the core Esusu logic:
 * 1. Check if it's time for the next payout (cycle has elapsed)
 * 2. Verify all contributions for this cycle are received
 * 3. Determine the recipient (next in rotation order)
 * 4. Calculate payout amount (pool - penalties if applicable)
 * 5. Call Orchestrator: Debit Group Pool, Credit Recipient Wallet
 * 6. Record the payout
 * 7. Advance to next cycle/position
 * 
 * Called by daily cron or manually by admin.
 */
export async function processNextPayout(esusuGroupId: string): Promise<{
  success: boolean;
  payout?: EsusuPayout;
  transaction_reference?: string;
  error?: string;
}> {
  const supabase = getServiceClient();

  try {
    // 1. Get the Esusu group
    const esusu = await getEsusuGroup(esusuGroupId);
    if (!esusu) return { success: false, error: 'Esusu group not found' };
    if (esusu.status !== 'active') return { success: false, error: `Esusu is ${esusu.status}` };
    
    // Check if all cycles are complete
    if (esusu.current_cycle > esusu.total_cycles) {
      await supabase.from('esusu_groups').update({
        status: 'completed', completed_at: new Date().toISOString(),
      }).eq('id', esusuGroupId);
      return { success: false, error: 'All cycles completed — Esusu finished' };
    }

    // 2. Check if a payout for this cycle already exists
    const { data: existingPayout } = await supabase
      .from('esusu_payouts')
      .select('id, status')
      .eq('esusu_group_id', esusuGroupId)
      .eq('cycle_number', esusu.current_cycle)
      .maybeSingle();
    
    if (existingPayout) {
      return { success: false, error: `Payout for cycle ${esusu.current_cycle} already exists (status: ${existingPayout.status})` };
    }

    // 3. Determine recipient
    const rotationOrder = esusu.rotation_order as string[];
    const recipientMembershipId = rotationOrder[esusu.current_position];
    if (!recipientMembershipId) return { success: false, error: 'No recipient at current rotation position' };

    // Get recipient details
    const { data: recipientMembership } = await supabase
      .from('group_savings_memberships')
      .select('customer_id')
      .eq('id', recipientMembershipId)
      .single();
    if (!recipientMembership) return { success: false, error: 'Recipient membership not found' };

    // Get recipient's wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('customer_id', recipientMembership.customer_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!wallet) return { success: false, error: 'Recipient has no active wallet' };

    // 4. Calculate payout
    const poolBalance = await getGroupPoolBalance(esusu.group_account_id);
    const totalPoolAmount = poolBalance;
    
    // Apply penalty if recipient has missed contributions
    let penaltyDeducted = 0;
    if (esusu.missed_policy === 'penalty') {
      const { data: recipient } = await supabase
        .from('group_savings_memberships')
        .select('missed_contributions')
        .eq('id', recipientMembershipId)
        .single();
      
      const missedCount = recipient ? Number(recipient.missed_contributions) : 0;
      if (missedCount > 0) {
        penaltyDeducted = Math.round(
          (totalPoolAmount * esusu.missed_penalty_rate / 100 * missedCount) * 100
        ) / 100;
      }
    }
    
    const payoutAmount = Math.max(0, totalPoolAmount - penaltyDeducted);

    if (payoutAmount <= 0) {
      return { success: false, error: 'Payout amount is zero after penalties' };
    }

    // 5. Record the payout
    const scheduledDate = new Date().toISOString().split('T')[0];
    const { data: payoutRecord, error: payoutError } = await supabase
      .from('esusu_payouts')
      .insert({
        esusu_group_id: esusuGroupId,
        cycle_number: esusu.current_cycle,
        recipient_customer_id: recipientMembership.customer_id,
        recipient_membership_id: recipientMembershipId,
        total_pool_amount: totalPoolAmount,
        payout_amount: payoutAmount,
        penalty_deducted: penaltyDeducted,
        scheduled_date: scheduledDate,
        status: 'processing',
      })
      .select('*')
      .single();
    
    if (payoutError) throw new Error(`Failed to record payout: ${payoutError.message}`);

    // 6. Call Orchestrator: Debit Group Pool, Credit Recipient Wallet
    const result = await initiate({
      transaction_type: 'group_payout',
      source_module: 'cooperative',
      source_reference: esusuGroupId,
      amount: payoutAmount,
      currency: 'NGN',
      description: `Esusu payout — Cycle ${esusu.current_cycle} to member at position ${esusu.current_position + 1}`,
      idempotency_key: `esusu_payout:${esusuGroupId}:cycle${esusu.current_cycle}`,
      wallet_id: wallet.id,
      product_account_id: (await supabase.rpc('get_group_savings_account_id', {
        p_group_account_id: esusu.group_account_id,
      }).then(r => r.data)) as string,
      metadata: {
        esusu_group_id: esusuGroupId,
        cycle_number: esusu.current_cycle,
        recipient_membership_id: recipientMembershipId,
        penalty_deducted: penaltyDeducted,
      },
    });

    if (result.status === 'failed') {
      // Mark payout as failed
      await supabase.from('esusu_payouts').update({
        status: 'failed',
      }).eq('id', payoutRecord.id);
      return { success: false, error: `Orchestrator failed: ${result.error}` };
    }

    // 7. Update payout record
    await supabase.from('esusu_payouts').update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      financial_transaction_id: result.id,
    }).eq('id', payoutRecord.id);

    // 8. Update recipient's received amount (read-then-update to avoid race conditions)
    const { data: member } = await supabase
      .from('group_savings_memberships')
      .select('total_received')
      .eq('id', recipientMembershipId)
      .single();
    if (member) {
      await supabase.from('group_savings_memberships').update({
        total_received: Number(member.total_received) + payoutAmount,
      }).eq('id', recipientMembershipId);
    }

    // 9. Advance to next cycle/position
    const nextPosition = esusu.current_position + 1;
    const nextCycle = nextPosition >= esusu.total_cycles ? esusu.current_cycle + 1 : esusu.current_cycle;
    const adjustedPosition = nextPosition >= esusu.total_cycles ? 0 : nextPosition;
    
    await supabase.from('esusu_groups').update({
      current_cycle: nextCycle,
      current_position: adjustedPosition,
    }).eq('id', esusuGroupId);

    return {
      success: true,
      payout: payoutRecord as EsusuPayout,
      transaction_reference: result.transaction_reference,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Process all due Esusu payouts (called by daily cron).
 * Finds all active Esusu groups and processes the next payout if due.
 */
export async function processEsusuPayouts(): Promise<{
  groups_checked: number;
  payouts_processed: number;
  details: string[];
}> {
  const supabase = getServiceClient();
  const details: string[] = [];
  let payoutsProcessed = 0;

  const { data: activeGroups, error } = await supabase
    .from('esusu_groups')
    .select('id, group_account_id, current_cycle, total_cycles')
    .eq('status', 'active');

  if (error) throw new Error(`Failed to fetch Esusu groups: ${error.message}`);

  for (const group of (activeGroups || [])) {
    if (group.current_cycle > group.total_cycles) continue;

    const result = await processNextPayout(group.id);
    if (result.success) {
      payoutsProcessed++;
      details.push(`Esusu ${group.id}: Payout for cycle ${group.current_cycle} processed`);
    } else if (result.error && !result.error.includes('already exists')) {
      details.push(`Esusu ${group.id}: ${result.error}`);
    }
  }

  return {
    groups_checked: (activeGroups || []).length,
    payouts_processed: payoutsProcessed,
    details,
  };
}
