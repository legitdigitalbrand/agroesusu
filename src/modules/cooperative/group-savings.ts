// ============================================================================
// Group Savings Mechanics
// 
// Group savings accounts (Equal Share, Common Pool, Seasonal, Emergency Fund).
// Each account gets its own liability ledger account under 2005.
// Contributions and payouts go through the Orchestrator.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { getAccountBalance } from '@/modules/ledger';
import type { GroupSavingsProduct, GroupSavingsAccount, GroupSavingsMembership } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function listGroupSavingsProducts(): Promise<GroupSavingsProduct[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('group_savings_products')
    .select('*')
    .eq('is_active', true)
    .order('product_name', { ascending: true });
  if (error) throw new Error(`Failed to list group savings products: ${error.message}`);
  return (data || []) as GroupSavingsProduct[];
}

export async function createGroupSavingsAccount(
  productId: string,
  name: string,
  cooperativeId?: string,
  description?: string,
): Promise<GroupSavingsAccount> {
  const supabase = getServiceClient();
  
  const { data, error } = await supabase
    .from('group_savings_accounts')
    .insert({
      product_id: productId,
      cooperative_id: cooperativeId || null,
      name, description: description || null,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create group savings account: ${error.message}`);
  
  return data as GroupSavingsAccount;
}

export async function activateGroupAccount(accountId: string): Promise<void> {
  const supabase = getServiceClient();
  // This trigger creates the ledger account under 2005
  const { error } = await supabase
    .from('group_savings_accounts')
    .update({ status: 'active', cycle_start_date: new Date().toISOString().split('T')[0] })
    .eq('id', accountId)
    .eq('status', 'pending');
  if (error) throw new Error(`Failed to activate group account: ${error.message}`);
}

export async function getGroupSavingsAccount(accountId: string): Promise<GroupSavingsAccount | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('group_savings_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get group savings account: ${error.message}`);
  return data as GroupSavingsAccount | null;
}

export async function getGroupPoolBalance(accountId: string): Promise<number> {
  const supabase = getServiceClient();
  const { data: ledgerAccountId } = await supabase.rpc('get_group_savings_account_id', {
    p_group_account_id: accountId,
  });
  if (!ledgerAccountId) return 0;
  return await getAccountBalance(ledgerAccountId as string);
}

export async function joinGroupSavings(
  accountId: string,
  customerId: string,
  cooperativeMembershipId?: string,
): Promise<GroupSavingsMembership> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('group_savings_memberships')
    .insert({
      group_account_id: accountId,
      customer_id: customerId,
      cooperative_membership_id: cooperativeMembershipId || null,
      status: 'active',
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Already a member of this group');
    throw new Error(`Failed to join group savings: ${error.message}`);
  }
  return data as GroupSavingsMembership;
}

export async function getGroupMembers(accountId: string): Promise<GroupSavingsMembership[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('group_savings_memberships')
    .select('*')
    .eq('group_account_id', accountId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });
  if (error) throw new Error(`Failed to get group members: ${error.message}`);
  return (data || []) as GroupSavingsMembership[];
}

/**
 * Contribute to a group savings pool.
 * Posts through the Orchestrator: Debit Wallet, Credit Group Pool.
 */
export async function contributeToGroup(
  accountId: string,
  walletId: string,
  amount: number,
): Promise<{ success: boolean; transaction_reference?: string; error?: string }> {
  const supabase = getServiceClient();

  try {
    // Look up group pool ledger account
    const { data: ledgerAccountId } = await supabase.rpc('get_group_savings_account_id', {
      p_group_account_id: accountId,
    });
    if (!ledgerAccountId) return { success: false, error: 'Group pool ledger account not found' };

    // Call Orchestrator
    const result = await initiate({
      transaction_type: 'group_contribution',
      source_module: 'cooperative',
      source_reference: accountId,
      amount,
      currency: 'NGN',
      description: `Group savings contribution`,
      idempotency_key: `group_contribution:${accountId}:${walletId}:${Date.now()}`,
      wallet_id: walletId,
      product_account_id: ledgerAccountId as string,
      metadata: { group_account_id: accountId },
    });

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Orchestrator failed' };
    }

    // Update member contribution tracking
    await supabase.rpc('update_group_member_contribution', {
      p_group_account_id: accountId,
      p_wallet_id: walletId,
      p_amount: amount,
    }).then(() => {}, () => {}); // Best effort — RPC may not exist yet

    return { success: true, transaction_reference: result.transaction_reference };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Process a group savings distribution/payout.
 * Posts through the Orchestrator: Debit Group Pool, Credit Wallet.
 */
export async function processGroupPayout(
  accountId: string,
  recipientWalletId: string,
  amount: number,
  description: string,
): Promise<{ success: boolean; transaction_reference?: string; error?: string }> {
  const supabase = getServiceClient();

  try {
    const { data: ledgerAccountId } = await supabase.rpc('get_group_savings_account_id', {
      p_group_account_id: accountId,
    });
    if (!ledgerAccountId) return { success: false, error: 'Group pool ledger account not found' };

    const result = await initiate({
      transaction_type: 'group_payout',
      source_module: 'cooperative',
      source_reference: accountId,
      amount,
      currency: 'NGN',
      description,
      idempotency_key: `group_payout:${accountId}:${recipientWalletId}:${Date.now()}`,
      wallet_id: recipientWalletId,
      product_account_id: ledgerAccountId as string,
      metadata: { group_account_id: accountId, payout: true },
    });

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Orchestrator failed' };
    }

    return { success: true, transaction_reference: result.transaction_reference };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
