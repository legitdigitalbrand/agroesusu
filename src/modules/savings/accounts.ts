// ============================================================================
// Savings Account Lifecycle Management
// 
// Creates and manages savings account instances. Each account:
//   - References a product config (with terms snapshot at opening)
//   - Gets its own ledger account (via trigger when status → active)
//   - Tracks lifecycle status
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getProduct } from './products';
import { getAccountBalance } from '@/modules/ledger';
import type { SavingsAccount, OpenAccountRequest } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Open a savings account.
 * Captures a snapshot of the product terms at opening — config changes
 * don't retroactively affect existing accounts.
 */
export async function openAccount(request: OpenAccountRequest): Promise<SavingsAccount> {
  const supabase = getServiceClient();

  // 1. Get the product config
  const product = await getProduct(request.product_id);
  if (!product) throw new Error('Product not found');
  if (!product.is_active) throw new Error('Product is not active');

  // 2. Capture terms snapshot (so config changes don't affect existing accounts)
  const termsSnapshot = {
    interest_rate: product.interest_rate,
    interest_method: product.interest_method,
    interest_cadence: product.interest_cadence,
    lock_period_days: product.lock_period_days,
    early_withdrawal_penalty_rate: product.early_withdrawal_penalty_rate,
    early_withdrawal_allowed: product.early_withdrawal_allowed,
    minimum_balance: product.minimum_balance,
    term_days: product.term_days,
  };

  // 3. Calculate maturity date for fixed-term products
  let maturityDate: string | null = null;
  if (product.term_days && product.term_days > 0) {
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + product.term_days);
    maturityDate = maturity.toISOString();
  }

  // 4. Create the account (status: pending — activates on first deposit)
  const { data, error } = await supabase
    .from('savings_accounts')
    .insert({
      customer_id: request.customer_id,
      wallet_id: request.wallet_id,
      product_id: request.product_id,
      status: 'pending',
      product_terms_snapshot: termsSnapshot,
      maturity_date: maturityDate,
      target_amount: request.target_amount || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to open savings account: ${error.message}`);

  const account = data as SavingsAccount;

  // 5. If initial deposit provided, activate the account
  // The actual deposit will be processed by the API layer calling deposit()
  // after this returns (see POST /api/savings/accounts)
  if (request.initial_deposit && request.initial_deposit > 0) {
    await activateAccount(account.id);
  }

  return account;
}

/** Activate a savings account (transitions pending → active) */
export async function activateAccount(accountId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('savings_accounts')
    .update({
      status: 'active',
      opened_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .eq('status', 'pending');  // Only pending accounts can be activated

  if (error) throw new Error(`Failed to activate account: ${error.message}`);
}

/** Get a savings account by ID */
export async function getAccount(accountId: string): Promise<SavingsAccount | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get account: ${error.message}`);
  return data as SavingsAccount | null;
}

/** List all savings accounts for a customer */
export async function listCustomerAccounts(customerId: string): Promise<SavingsAccount[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list accounts: ${error.message}`);
  return (data || []) as SavingsAccount[];
}

/** Get the savings account balance from the Ledger */
export async function getSavingsBalance(accountId: string): Promise<number> {
  const supabase = getServiceClient();
  
  // Look up the ledger account for this savings account
  const { data, error } = await supabase.rpc('get_savings_account_id', {
    p_savings_account_id: accountId,
  });

  if (error || !data) return 0;

  return await getAccountBalance(data as string);
}

/** Mark a fixed deposit as matured */
export async function markAsMatured(accountId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('savings_accounts')
    .update({ status: 'matured' })
    .eq('id', accountId)
    .eq('status', 'active');

  if (error) throw new Error(`Failed to mark as matured: ${error.message}`);
}

/** Close a savings account */
export async function closeAccount(accountId: string, reason?: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('savings_accounts')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      metadata: { close_reason: reason },
    })
    .eq('id', accountId)
    .in('status', ['active', 'matured', 'withdrawn']);

  if (error) throw new Error(`Failed to close account: ${error.message}`);
}
