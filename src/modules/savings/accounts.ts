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
import type { SavingsAccount, OpenAccountRequest, OpenPotRequest } from './types';

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
 * 
 * For Flexible Savings with goal tracking, pass goal_enabled=true along with
 * goal_amount, goal_date, monthly_target, and nickname.
 */
export async function openAccount(request: OpenAccountRequest): Promise<SavingsAccount> {
  const supabase = getServiceClient();

  // 1. Get the product config
  const product = await getProduct(request.product_id);
  if (!product) throw new Error('Product not found');
  if (!product.is_active) throw new Error('Product is not active');

  // 2. Prevent duplicate flexible accounts (one per customer, unless goal-enabled)
  if (product.product_type === 'flexible') {
    if (request.goal_enabled) {
      // Goal-based flexible accounts can have multiple (one per goal)
      // Check for limit of 10 active goal-based flexible accounts
      const { data: existingGoals } = await supabase
        .from('savings_accounts')
        .select('id')
        .eq('customer_id', request.customer_id)
        .eq('product_id', request.product_id)
        .eq('goal_enabled', true)
        .in('status', ['pending', 'active']);
      
      if (existingGoals && existingGoals.length >= 10) {
        throw new Error('You can have at most 10 active savings goals. Consider archiving completed ones.');
      }
    } else {
      // Non-goal flexible: one per customer
      const { data: existing } = await supabase
        .from('savings_accounts')
        .select('id, status')
        .eq('customer_id', request.customer_id)
        .eq('product_id', request.product_id)
        .eq('goal_enabled', false)
        .in('status', ['pending', 'active'])
        .maybeSingle();

      if (existing) {
        throw new Error('You already have an active Flexible Savings account. Deposit into it instead of opening a new one.');
      }
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
    minimum_deposit: product.minimum_deposit,
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
  const insertData: Record<string, unknown> = {
    customer_id: request.customer_id,
    wallet_id: request.wallet_id,
    product_id: request.product_id,
    status: 'pending',
    product_terms_snapshot: termsSnapshot,
    maturity_date: maturityDate,
  };

  // Goal tracking fields (Flexible Savings only)
  if (product.product_type === 'flexible' && request.goal_enabled) {
    insertData.goal_enabled = true;
    insertData.target_amount = request.goal_amount || request.target_amount || null;
    insertData.goal_date = request.goal_date || null;
    insertData.monthly_target = request.monthly_target || null;
    insertData.pot_name = request.nickname || null;
  } else if (request.target_amount) {
    // Legacy: target_amount without goal_enabled
    insertData.target_amount = request.target_amount;
  }

  const { data, error } = await supabase
    .from('savings_accounts')
    .insert(insertData)
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
        interest_cadence,
        term_days,
        lock_period_days,
        early_withdrawal_penalty_rate,
        minimum_deposit,
        withdrawal_allowed
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
        interest_cadence,
        term_days,
        lock_period_days,
        early_withdrawal_penalty_rate,
        minimum_deposit,
        withdrawal_allowed
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

  if (error) throw new Error(`Failed to close savings account: ${error.message}`);
}

/** Update goal metadata on a savings account (Flexible Savings with goal tracking) */
export async function updateAccountGoal(
  accountId: string,
  updates: {
    nickname?: string;
    target_amount?: number;
    goal_date?: string | null;
    monthly_target?: number | null;
    goal_enabled?: boolean;
  }
): Promise<SavingsAccount> {
  const supabase = getServiceClient();

  const updateData: Record<string, unknown> = {};
  if (updates.nickname !== undefined) updateData.pot_name = updates.nickname;
  if (updates.target_amount !== undefined) updateData.target_amount = updates.target_amount;
  if (updates.goal_date !== undefined) updateData.goal_date = updates.goal_date || null;
  if (updates.monthly_target !== undefined) {
    updateData.monthly_target = updates.monthly_target || null;
  }
  if (updates.goal_enabled !== undefined) updateData.goal_enabled = updates.goal_enabled;

  const { data, error } = await supabase
    .from('savings_accounts')
    .update(updateData)
    .eq('id', accountId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update savings goal: ${error.message}`);
  return data as SavingsAccount;
}

/**
 * Open a custom savings pot. — DEPRECATED
 * Use openAccount() with goal_enabled=true instead.
 * Kept for backwards compatibility.
 */
export async function openCustomPot(request: OpenPotRequest): Promise<SavingsAccount> {
  const supabase = getServiceClient();

  // 1. Get the custom pot product config
  const product = await getProduct(request.product_id);
  if (!product) throw new Error('Product not found');
  if (!product.is_active) throw new Error('Product is not active');

  // 2. Calculate interest rate based on lock duration
  let interestRate = product.interest_rate; // Default (flexible = 4%)
  let lockPeriodDays = 0;

  if (request.lock_type === 'locked' && request.lock_until_date) {
    const now = new Date();
    const lockDate = new Date(request.lock_until_date);
    lockPeriodDays = Math.max(1, Math.ceil((lockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    if (lockPeriodDays >= 365) interestRate = 16;
    else if (lockPeriodDays >= 180) interestRate = 14;
    else if (lockPeriodDays >= 90) interestRate = 12;
    else if (lockPeriodDays >= 30) interestRate = 8;
    else interestRate = 6;
  }

  // 3. Capture terms snapshot
  const termsSnapshot = {
    interest_rate: interestRate,
    interest_method: product.interest_method,
    interest_cadence: product.interest_cadence,
    lock_period_days: lockPeriodDays,
    early_withdrawal_penalty_rate: product.early_withdrawal_penalty_rate,
    early_withdrawal_allowed: product.early_withdrawal_allowed,
    minimum_balance: product.minimum_balance,
    term_days: null,
    lock_type: request.lock_type,
    lock_until_date: request.lock_until_date,
  };

  // 4. Create the account
  const { data, error } = await supabase
    .from('savings_accounts')
    .insert({
      customer_id: request.customer_id,
      wallet_id: request.wallet_id,
      product_id: request.product_id,
      status: 'pending',
      product_terms_snapshot: termsSnapshot,
      maturity_date: request.lock_type === 'locked' ? request.lock_until_date : null,
      target_amount: request.target_amount || null,
      pot_name: request.pot_name,
      pot_icon: request.pot_icon || 'piggybank',
      pot_color: request.pot_color || 'indigo',
      metadata: {
        lock_type: request.lock_type,
        is_custom_pot: true,
      },
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create savings pot: ${error.message}`);

  const account = data as SavingsAccount;

  if (request.initial_deposit && request.initial_deposit > 0) {
    await activateAccount(account.id);
  }

  return account;
}
