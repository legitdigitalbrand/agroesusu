// ============================================================================
// Ledger Account Management
// 
// Functions for looking up accounts in the chart of accounts.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { Account } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Get an account by its code (e.g., '1000' for Safe Haven Settlement) */
export async function getAccountByCode(code: string): Promise<Account | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_code', code)
    .maybeSingle();
  if (error) throw new Error(`Failed to get account ${code}: ${error.message}`);
  return data as Account | null;
}

/** Get the ledger account ID for a wallet (via SQL function) */
export async function getWalletAccountId(walletId: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('get_wallet_account_id', { p_wallet_id: walletId });
  if (error) throw new Error(`Failed to get wallet account: ${error.message}`);
  return data as string | null;
}

/** Get the balance of an account from journal lines (via SQL function) */
export async function getAccountBalance(accountId: string): Promise<number> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('get_account_balance', { p_account_id: accountId });
  if (error) throw new Error(`Failed to get account balance: ${error.message}`);
  return Number(data) || 0;
}

/** Get a system account by category (e.g., 'safe_haven_settlement') */
export async function getSystemAccount(category: string): Promise<Account | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_category', category)
    .eq('is_system_account', true)
    .maybeSingle();
  if (error) throw new Error(`Failed to get system account ${category}: ${error.message}`);
  return data as Account | null;
}

/** Refresh the wallet balance cache from the Ledger (via SQL function) */
export async function refreshWalletBalanceCache(walletId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.rpc('refresh_wallet_balance_cache', { p_wallet_id: walletId });
  if (error) throw new Error(`Failed to refresh wallet balance: ${error.message}`);
}
