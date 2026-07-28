// ============================================================================
// Investment Returns & Valuation Engine
// 
// Handles:
//   - Returns calculation (flat and compound) — for GUARANTEED and EXPECTED products only
//   - Returns payout (to wallet) or reinvestment (auto-reinvest)
//   - Maturity processing
// 
// CRITICAL DISTINCTION:
//   - 'guaranteed' products: returns calculated from formula (rate × principal × time)
//   - 'expected' products: returns calculated from formula (same as guaranteed, but not contractual)
//   - 'variable_pool' products: returns come from POOL PERFORMANCE RECORDS entered by admin
//     — the daily cron does NOT process these. They use distributePoolReturns() instead.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import type { ReturnsResult } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Calculate returns for a fixed/expected investment account.
 * 
 * Flat returns: returns = principal × rate × (days_elapsed / 365)
 * Compound returns: returns = principal × ((1 + rate/365)^days_elapsed) - 1
 * 
 * NOTE: This function is ONLY for 'guaranteed' and 'expected' return products.
 * 'variable_pool' products get their returns from pool performance records.
 */
export function calculateReturns(
  principal: number,
  annualRate: number,
  daysElapsed: number,
  returnType: 'flat' | 'compound',
): number {
  if (returnType === 'flat') {
    return Math.round(principal * (annualRate / 100) * (daysElapsed / 365) * 100) / 100;
  }
  // Compound (daily compounding)
  const dailyRate = annualRate / 100 / 365;
  const compoundFactor = Math.pow(1 + dailyRate, daysElapsed) - 1;
  return Math.round(principal * compoundFactor * 100) / 100;
}

/**
 * Calculate management fee.
 * Fee = AUM × (fee_rate / 100) × (days_elapsed / 365)
 */
export function calculateManagementFee(
  currentValue: number,
  feeRate: number,
  daysElapsed: number,
): number {
  return Math.round(currentValue * (feeRate / 100) * (daysElapsed / 365) * 100) / 100;
}

/**
 * Process returns for a single investment account.
 * 
 * ONLY processes 'guaranteed' and 'expected' return products.
 * 'variable_pool' products are skipped — they use pool performance distribution.
 * 
 * If auto_reinvest is enabled: posts investment_reinvest (D Interest Expense, C Investment Settlement)
 * If payout: posts investment_returns (D Interest Expense, C Wallet)
 */
export async function processReturns(
  accountId: string,
  walletId?: string,
): Promise<ReturnsResult> {
  const supabase = getServiceClient();

  try {
    const { data: account } = await supabase
      .from('investment_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('status', 'active')
      .maybeSingle();
    if (!account) return { success: false, error: 'Active investment account not found' };

    // Look up the product to check return_guarantee
    const { data: product } = await supabase
      .from('investment_products')
      .select('return_guarantee, product_name')
      .eq('id', account.product_id)
      .single();
    
    if (product?.return_guarantee === 'variable_pool') {
      // Skip — variable_pool products get returns from pool performance, not formula
      return { success: false, error: 'Variable pool product — returns come from pool performance records, not daily accrual' };
    }

    const terms = account.terms_snapshot as Record<string, unknown>;
    const autoReinvest = terms.auto_reinvest as boolean || false;

    // Calculate days elapsed since last valuation
    const lastValuation = account.last_valuation_date
      ? new Date(account.last_valuation_date)
      : new Date(account.start_date || account.created_at);
    const daysElapsed = Math.floor((Date.now() - lastValuation.getTime()) / (1000 * 60 * 60 * 24));

    if (daysElapsed <= 0) return { success: false, error: 'No days elapsed since last valuation' };

    const principal = Number(account.principal_amount);
    const rate = terms.expected_return_rate as number;
    const returnType = terms.return_type as 'flat' | 'compound';

    // Calculate gross returns
    const grossReturns = calculateReturns(principal, rate, daysElapsed, returnType);

    // Calculate management fee
    const feeRate = terms.management_fee_rate as number || 0;
    const currentValue = Number(account.current_value);
    const managementFee = calculateManagementFee(currentValue, feeRate, daysElapsed);

    // Net returns
    const netReturns = Math.max(0, grossReturns - managementFee);

    if (netReturns <= 0) {
      return { success: false, error: 'Net returns are zero or negative' };
    }

    // Look up investment ledger account
    const { data: ledgerAccountId } = await supabase.rpc('get_investment_account_id', {
      p_investment_account_id: accountId,
    });
    if (!ledgerAccountId) return { success: false, error: 'Investment ledger account not found' };

    let ftResult;
    let reinvested = false;

    if (autoReinvest) {
      // Reinvest: D Interest Expense, C Investment Settlement
      ftResult = await initiate({
        transaction_type: 'investment_reinvest',
        source_module: 'investments',
        source_reference: accountId,
        amount: netReturns,
        currency: 'NGN',
        description: `Returns reinvested (auto-reinvest)`,
        idempotency_key: `investment_reinvest:${accountId}:${new Date().toISOString().split('T')[0]}`,
        product_account_id: ledgerAccountId as string,
        metadata: { investment_account_id: accountId, gross_returns: grossReturns, management_fee: managementFee },
      });
      reinvested = true;
    } else {
      // Payout to wallet: D Interest Expense, C Wallet
      if (!walletId) return { success: false, error: 'wallet_id required for returns payout (non-reinvest)' };
      ftResult = await initiate({
        transaction_type: 'investment_returns',
        source_module: 'investments',
        source_reference: accountId,
        amount: netReturns,
        currency: 'NGN',
        description: `Investment returns payout`,
        idempotency_key: `investment_returns:${accountId}:${new Date().toISOString().split('T')[0]}`,
        wallet_id: walletId,
        metadata: { investment_account_id: accountId, gross_returns: grossReturns, management_fee: managementFee },
      });
    }

    if (ftResult.status === 'failed') {
      return { success: false, error: `Orchestrator failed: ${ftResult.error}` };
    }

    // Record investment transaction
    await supabase.from('investment_transactions').insert({
      investment_account_id: accountId,
      customer_id: account.customer_id,
      transaction_type: reinvested ? 'returns_reinvest' : 'returns_payout',
      amount: netReturns,
      financial_transaction_id: ftResult.id,
      source_reference: ftResult.transaction_reference,
      status: 'completed',
      metadata: { gross_returns: grossReturns, management_fee: managementFee, days_elapsed: daysElapsed },
    });

    // Update account
    const newCurrentValue = reinvested
      ? Number(account.current_value) + netReturns
      : Number(account.current_value);

    const newReturnsEarned = Number(account.returns_earned) + netReturns;
    const newReturnsPaidOut = reinvested
      ? Number(account.returns_paid_out)
      : Number(account.returns_paid_out) + netReturns;

    await supabase.from('investment_accounts').update({
      current_value: newCurrentValue,
      returns_earned: newReturnsEarned,
      returns_paid_out: newReturnsPaidOut,
      last_valuation_date: new Date().toISOString(),
    }).eq('id', accountId);

    return {
      success: true,
      transaction_reference: ftResult.transaction_reference,
      returns_amount: netReturns,
      reinvested,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Batch process returns for all active investment accounts.
 * Called by daily cron at 9 AM.
 * 
 * ONLY processes 'guaranteed' and 'expected' return products.
 * 'variable_pool' products are skipped — admin must trigger distribution
 * after entering pool performance data.
 */
export async function batchProcessReturns(): Promise<{
  accounts_checked: number;
  returns_processed: number;
  pool_accounts_skipped: number;
  details: string[];
}> {
  const supabase = getServiceClient();
  const details: string[] = [];
  let returnsProcessed = 0;
  let poolAccountsSkipped = 0;

  const { data: activeAccounts, error } = await supabase
    .from('investment_accounts')
    .select('id, customer_id, product_id')
    .eq('status', 'active');

  if (error) throw new Error(`Failed to fetch active investment accounts: ${error.message}`);

  // Get product return_guarantee for all accounts in one query
  const productIds = [...new Set((activeAccounts || []).map((a: { product_id: string }) => a.product_id))];
  let productMap: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('investment_products')
      .select('id, return_guarantee')
      .in('id', productIds);
    productMap = Object.fromEntries((products || []).map((p: { id: string; return_guarantee: string }) => [p.id, p.return_guarantee]));
  }

  for (const account of (activeAccounts || [])) {
    const returnGuarantee = productMap[account.product_id];
    
    if (returnGuarantee === 'variable_pool') {
      poolAccountsSkipped++;
      continue; // Skip — pool products use pool performance distribution
    }

    // Look up the customer's wallet for non-reinvest returns
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('customer_id', account.customer_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const result = await processReturns(account.id, wallet?.id);
    if (result.success) {
      returnsProcessed++;
      details.push(`Account ${account.id}: Returns ${result.reinvested ? 'reinvested' : 'paid out'} ₦${result.returns_amount}`);
    } else if (result.error && !result.error.includes('No days elapsed') && !result.error.includes('variable pool')) {
      details.push(`Account ${account.id}: ${result.error}`);
    }
  }

  return {
    accounts_checked: (activeAccounts || []).length,
    returns_processed: returnsProcessed,
    pool_accounts_skipped: poolAccountsSkipped,
    details,
  };
}

/**
 * Check for matured investments and mark them.
 */
export async function processMaturities(): Promise<{ matured_count: number }> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data: matured, error } = await supabase
    .from('investment_accounts')
    .update({ status: 'matured' })
    .eq('status', 'active')
    .not('maturity_date', 'is', null)
    .lte('maturity_date', now)
    .select('id');

  if (error) throw new Error(`Failed to process maturities: ${error.message}`);

  return { matured_count: matured?.length || 0 };
}
