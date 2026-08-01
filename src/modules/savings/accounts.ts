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

/** Account with product info joined (for customer-facing lists) */
export interface AccountWithProduct extends SavingsAccount {
  product?: {
    product_name: string;
    product_code: string;
    product_type: string;
    interest_rate: number;
    interest_method: string;
    term_days: number | null;
  };
  current_balance?: number;
}

/**
 * Open a savings account.
 * Prevents duplicate flexible accounts. Fixed deposits can have multiple.
 * Captures a snapshot of the product terms at opening.
 */
export async function openAccount(request: OpenAccountRequest): Promise<SavingsAccount> {
  const supabase = getServiceClient();

  // 1. Get the product config
  const product = await getProduct(request.product_id);
  if (!product) throw new Error('Product not found');
  if (!product.is_active) throw new Error('Product is not active');

  // 2. Prevent duplicate flexible accounts (one per customer)
  if (product.product_type === 'flexible') {
    const { data: existing } = await supabase
      .from('savings_accounts')
      .select('id, status')
      .eq('customer_id', request.customer_id)
      .eq('product_id', request.product_id)
      .in('status', ['pending', 'active'])
      .maybeSingle();

    if (existing) {
      throw new Error('You already have an active Flexible Savings account. Deposit into it instead of opening a new one.');
    }
  }

  // 3. Capture terms snapshot (so config changes don't affect existing accounts)
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

  // 4. Calculate maturity date for fixed-term products
  let maturityDate: string | null = null;
  if (product.term_days && product.term_days > 0) {
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + product.term_days);
    maturityDate = maturity.toISOString();
  }

  // 5. Create the account (status: pending — activates on first deposit)
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

  // 6. If initial deposit provided, activate the account
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
    .eq('status', 'pending');

  if (error) throw new Error(`Failed to activate savings account: ${error.message}`);
}

/** Get a savings account by ID (with product info) */
export async function getAccount(accountId: string): Promise<AccountWithProduct | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_accounts')
    .select(`
      *,
      product:savings_products (
        product_name,
        product_code,
        product_type,
        interest_rate,
        interest_method,
        term_days
      )
    `)
    .eq('id', accountId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get account: ${error.message}`);
  return data as AccountWithProduct | null;
}

/**
 * List all savings accounts for a customer — WITH product info joined.
 * This is the function the API should use so the frontend gets product names.
 */
export async function listCustomerAccounts(customerId: string): Promise<AccountWithProduct[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_accounts')
    .select(`
      *,
      product:savings_products (
        product_name,
        product_code,
        product_type,
        interest_rate,
        interest_method,
        term_days
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list accounts: ${error.message}`);
  return (data || []) as AccountWithProduct[];
}

/** Get the savings account balance from the Ledger */
export async function getSavingsBalance(accountId: string): Promise<number> {
  const supabase = getServiceClient();
  
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
