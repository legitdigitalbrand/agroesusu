// ============================================================================
// Investment Accounts — Lifecycle Management
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { getProduct } from './products';
import type { InvestmentAccount, SubscriptionRequest, SubscriptionResult, RedemptionRequest, RedemptionResult } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Create an investment account (pending status).
 * Does NOT move money — that happens in subscribe().
 */
export async function createInvestmentAccount(
  productId: string,
  customerId: string,
  amount: number,
  tenureDays?: number,
): Promise<InvestmentAccount> {
  const supabase = getServiceClient();
  const product = await getProduct(productId);
  if (!product) throw new Error('Investment product not found');
  if (!product.is_active) throw new Error('Investment product is not active');

  // Validate amount
  if (amount < product.min_investment) {
    throw new Error(`Minimum investment is ₦${product.min_investment.toFixed(2)}`);
  }
  if (product.max_investment && amount > product.max_investment) {
    throw new Error(`Maximum investment is ₦${product.max_investment.toFixed(2)}`);
  }

  // Validate tenure
  const tenure = tenureDays || product.min_tenure_days;
  if (tenure < product.min_tenure_days) {
    throw new Error(`Minimum tenure is ${product.min_tenure_days} days`);
  }
  if (product.max_tenure_days && tenure > product.max_tenure_days) {
    throw new Error(`Maximum tenure is ${product.max_tenure_days} days`);
  }

  // Capture terms snapshot (config changes won't affect existing accounts)
  const termsSnapshot = {
    expected_return_rate: product.expected_return_rate,
    return_type: product.return_type,
    management_fee_rate: product.management_fee_rate,
    early_exit_fee_rate: product.early_exit_fee_rate,
    early_exit_lock_days: product.early_exit_lock_days,
    allows_early_redemption: product.allows_early_redemption,
    allows_partial_redemption: product.allows_partial_redemption,
    allows_top_up: product.allows_top_up,
    auto_reinvest: product.auto_reinvest,
    risk_level: product.risk_level,
    risk_score: product.risk_score,
    tenure_days: tenure,
    product_name: product.product_name,
    product_code: product.product_code,
    investment_type: product.investment_type,
  };

  const { data, error } = await supabase
    .from('investment_accounts')
    .insert({
      product_id: productId,
      customer_id: customerId,
      principal_amount: amount,
      current_value: amount,   // Initially, current value = principal
      tenure_days: tenure,
      terms_snapshot: termsSnapshot,
      risk_disclosure_version: product.risk_disclosure_version,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create investment account: ${error.message}`);
  return data as InvestmentAccount;
}

/**
 * Accept risk disclosure — permanently stores the full disclosure text,
 * version, and acceptance metadata.
 * 
 * Per standing instructions: this is MANDATORY before subscription.
 */
export async function acceptRiskDisclosure(
  accountId: string,
  customerId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const supabase = getServiceClient();

  // Get account + product to capture the disclosure text
  const { data: account } = await supabase
    .from('investment_accounts')
    .select('product_id, risk_disclosure_version')
    .eq('id', accountId)
    .single();
  if (!account) throw new Error('Investment account not found');

  const product = await getProduct(account.product_id);
  if (!product) throw new Error('Investment product not found');

  // Update account to record acceptance
  const { error: updateError } = await supabase
    .from('investment_accounts')
    .update({
      risk_disclosure_accepted: true,
      risk_disclosure_accepted_at: new Date().toISOString(),
      risk_disclosure_version: product.risk_disclosure_version,
      risk_disclosure_ip_address: ipAddress,
      risk_disclosure_user_agent: userAgent,
    })
    .eq('id', accountId)
    .eq('risk_disclosure_accepted', false);  // Can't re-accept
  if (updateError) throw new Error(`Failed to record risk disclosure: ${updateError.message}`);

  // Permanently store the full disclosure acceptance record
  const { error: logError } = await supabase
    .from('risk_disclosure_acceptances')
    .insert({
      investment_account_id: accountId,
      customer_id: customerId,
      product_id: product.id,
      disclosure_text: product.risk_disclosure_text,
      disclosure_version: product.risk_disclosure_version,
      product_name: product.product_name,
      risk_level: product.risk_level,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  if (logError) throw new Error(`Failed to log risk disclosure acceptance: ${logError.message}`);
}

/**
 * Subscribe to an investment — the full flow:
 * 1. Create account (if not exists)
 * 2. Validate risk disclosure accepted
 * 3. Validate cooperative membership (if required)
 * 4. Call Orchestrator: D Wallet, C Investment Settlement
 * 5. Activate the investment account
 * 6. Record investment transaction
 */
export async function subscribe(request: SubscriptionRequest): Promise<SubscriptionResult> {
  const supabase = getServiceClient();

  try {
    const product = await getProduct(request.product_id);
    if (!product) return { success: false, error: 'Product not found' };
    if (!product.is_active) return { success: false, error: 'Product is not active' };

    // Check cooperative requirement
    if (product.cooperative_required) {
      const { data: coopMembership } = await supabase
        .from('cooperative_memberships')
        .select('id')
        .eq('customer_id', request.customer_id)
        .eq('status', 'active')
        .maybeSingle();
      if (!coopMembership) {
        return { success: false, error: 'This investment product requires cooperative membership' };
      }
    }

    // Create the account
    const account = await createInvestmentAccount(
      request.product_id, request.customer_id, request.amount, request.tenure_days
    );

    // Accept risk disclosure (mandatory)
    if (!request.accept_risk_disclosure) {
      return { success: false, error: 'Risk disclosure acceptance is mandatory before subscription' };
    }
    await acceptRiskDisclosure(account.id, request.customer_id, request.ip_address, request.user_agent);

    // Look up the investment ledger account (created by trigger when account is activated)
    // First activate the account (trigger creates ledger account)
    const { error: activateError } = await supabase
      .from('investment_accounts')
      .update({
        status: 'active',
        start_date: new Date().toISOString(),
        maturity_date: request.tenure_days
          ? new Date(Date.now() + request.tenure_days * 24 * 60 * 60 * 1000).toISOString()
          : null,
        current_value: request.amount,
        last_valuation_date: new Date().toISOString(),
      })
      .eq('id', account.id)
      .eq('status', 'pending');
    if (activateError) {
      return { success: false, error: `Failed to activate investment account: ${activateError.message}` };
    }

    // Now the trigger has created the ledger account — look it up
    const { data: ledgerAccountId } = await supabase.rpc('get_investment_account_id', {
      p_investment_account_id: account.id,
    });
    if (!ledgerAccountId) {
      return { success: false, error: 'Investment ledger account not found after activation' };
    }

    // Call Orchestrator: D Wallet, C Investment Settlement
    const result = await initiate({
      transaction_type: 'investment_subscription',
      source_module: 'investments',
      source_reference: account.id,
      amount: request.amount,
      currency: 'NGN',
      description: `Investment subscription: ${product.product_name}`,
      idempotency_key: `investment_subscription:${account.id}:${Date.now()}`,
      wallet_id: request.wallet_id,
      product_account_id: ledgerAccountId as string,
      metadata: { investment_account_id: account.id, product_id: request.product_id },
    });

    if (result.status === 'failed') {
      // Revert activation
      await supabase.from('investment_accounts').update({ status: 'pending' }).eq('id', account.id);
      return { success: false, error: `Orchestrator failed: ${result.error}` };
    }

    // Record investment transaction
    await supabase.from('investment_transactions').insert({
      investment_account_id: account.id,
      customer_id: request.customer_id,
      transaction_type: 'subscription',
      amount: request.amount,
      nav_at_transaction: product.nav_per_unit || null,
      units: product.nav_per_unit ? Math.round((request.amount / product.nav_per_unit) * 10000) / 10000 : null,
      financial_transaction_id: result.id,
      source_reference: result.transaction_reference,
      status: 'completed',
      metadata: { product_name: product.product_name },
    });

    // Update product units issued (for unitized)
    if (product.nav_per_unit && product.total_units_available) {
      const units = Math.round((request.amount / product.nav_per_unit) * 10000) / 10000;
      await supabase.rpc('increment_product_units', {
        p_product_id: request.product_id,
        p_units: units,
      }).then(() => {}, () => {}); // Best effort
    }

    // Return the updated account
    const { data: updatedAccount } = await supabase
      .from('investment_accounts')
      .select('*')
      .eq('id', account.id)
      .single();

    return {
      success: true,
      account: updatedAccount as InvestmentAccount,
      transaction_reference: result.transaction_reference,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Redeem an investment — full or partial.
 * Validates lock period and early exit fees before calling Orchestrator.
 */
export async function redeem(request: RedemptionRequest): Promise<RedemptionResult> {
  const supabase = getServiceClient();

  try {
    const { data: account } = await supabase
      .from('investment_accounts')
      .select('*')
      .eq('id', request.investment_account_id)
      .single();
    if (!account) return { success: false, error: 'Investment account not found' };
    if (account.status !== 'active' && account.status !== 'matured') {
      return { success: false, error: `Cannot redeem — account status is ${account.status}` };
    }

    const terms = account.terms_snapshot as Record<string, unknown>;
    const redeemAmount = request.is_partial && request.amount ? request.amount : Number(account.current_value);

    if (request.is_partial && !terms.allows_partial_redemption) {
      return { success: false, error: 'Partial redemption is not allowed for this product' };
    }

    // Check lock period
    if (account.start_date) {
      const daysSinceStart = Math.floor((Date.now() - new Date(account.start_date).getTime()) / (1000 * 60 * 60 * 24));
      const lockDays = terms.early_exit_lock_days as number || 0;
      if (daysSinceStart < lockDays) {
        return { success: false, error: `Early redemption not available until ${lockDays} days from subscription (currently ${daysSinceStart} days)` };
      }

      // Calculate early exit fee if before maturity
      let feeAmount = 0;
      if (account.maturity_date && new Date(account.maturity_date) > new Date()) {
        const feeRate = terms.early_exit_fee_rate as number || 0;
        feeAmount = Math.round(redeemAmount * feeRate / 100 * 100) / 100;
      }
      const netAmount = redeemAmount - feeAmount;

      // Look up investment ledger account
      const { data: ledgerAccountId } = await supabase.rpc('get_investment_account_id', {
        p_investment_account_id: account.id,
      });
      if (!ledgerAccountId) return { success: false, error: 'Investment ledger account not found' };

      // Call Orchestrator: D Investment Settlement, C Wallet
      const result = await initiate({
        transaction_type: 'investment_redemption',
        source_module: 'investments',
        source_reference: account.id,
        amount: netAmount,
        currency: 'NGN',
        description: `Investment redemption${request.is_partial ? ' (partial)' : ''}`,
        idempotency_key: `investment_redemption:${account.id}:${Date.now()}`,
        wallet_id: request.wallet_id,
        product_account_id: ledgerAccountId as string,
        metadata: {
          investment_account_id: account.id,
          gross_amount: redeemAmount,
          early_exit_fee: feeAmount,
          net_amount: netAmount,
          is_partial: request.is_partial,
        },
      });

      if (result.status === 'failed') {
        return { success: false, error: `Orchestrator failed: ${result.error}` };
      }

      // Record investment transaction
      await supabase.from('investment_transactions').insert({
        investment_account_id: account.id,
        customer_id: account.customer_id,
        transaction_type: 'redemption',
        amount: redeemAmount,
        financial_transaction_id: result.id,
        source_reference: result.transaction_reference,
        status: 'completed',
        metadata: { early_exit_fee: feeAmount, net_amount: netAmount, is_partial: request.is_partial },
      });

      // Update account
      const newValue = request.is_partial ? Number(account.current_value) - redeemAmount : 0;
      const newStatus = request.is_partial ? 'active' : 'redeemed';
      await supabase.from('investment_accounts').update({
        current_value: newValue,
        status: newStatus,
        last_valuation_date: new Date().toISOString(),
      }).eq('id', account.id);

      return {
        success: true,
        transaction_reference: result.transaction_reference,
        redeemed_amount: netAmount,
      };
    }

    return { success: false, error: 'Investment account has no start date' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getInvestmentAccount(accountId: string): Promise<InvestmentAccount | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investment_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get investment account: ${error.message}`);
  return data as InvestmentAccount | null;
}

export async function listCustomerAccounts(customerId: string): Promise<InvestmentAccount[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investment_accounts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list investment accounts: ${error.message}`);
  return (data || []) as InvestmentAccount[];
}

export async function getAccountTransactions(accountId: string): Promise<unknown[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('investment_transactions')
    .select('*')
    .eq('investment_account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to get investment transactions: ${error.message}`);
  return data || [];
}
