// ============================================================================
// Pool Performance & Distribution Engine
// 
// This module handles variable/pool-performance-based investment returns:
//   1. Admin enters pool performance (manually, with full audit trail)
//   2. System calculates proportional distribution to contributors
//   3. Distribution posts through the Orchestrator (payout or reinvest)
// 
// CRITICAL DISTINCTION from fixed-income returns:
//   - Fixed Income: returns calculated from formula (rate × principal × time)
//   - Pool Performance: returns come from ACTUAL pool performance entered by admin
//   - The system does NOT fabricate performance figures
//   - Every performance entry is traceable to who entered it and why
// 
// Data source: MANUAL ADMIN ENTRY (no automated data feed exists).
// Future integration points (crop yield APIs, market price feeds) are documented
// but NOT implemented — they would feed into the same admin entry interface.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import type { PoolPerformanceRecord, PoolPerformanceEntry, PoolDistribution, DistributionResult } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Record pool performance — admin-entered, fully auditable.
 * 
 * This is the INPUT MECHANISM for pool-based investment returns.
 * An admin staff member enters the actual pool performance based on real-world
 * outcomes (crop sales, cooperative profit distributions, etc.).
 * 
 * The record is NOT posted to the Ledger — it's an input record. Distribution
 * to individual contributors happens in distributePoolReturns().
 */
export async function recordPoolPerformance(entry: PoolPerformanceEntry): Promise<PoolPerformanceRecord> {
  const supabase = getServiceClient();

  // Validate the product is a variable_pool type
  const { data: product, error: productError } = await supabase
    .from('investment_products')
    .select('return_guarantee, product_name')
    .eq('id', entry.product_id)
    .single();
  if (productError || !product) throw new Error('Investment product not found');
  if (product.return_guarantee !== 'variable_pool') {
    throw new Error(`Pool performance can only be recorded for variable_pool products. This product (${product.product_name}) has return_guarantee = ${product.return_guarantee}`);
  }

  // Calculate net distributable (total returns minus expenses)
  const expenseRatio = entry.expense_ratio || 0;
  const expenseAmount = Math.round(entry.total_returns * expenseRatio / 100 * 100) / 100;
  const netDistributable = Math.round((entry.total_returns - expenseAmount) * 100) / 100;

  const { data, error } = await supabase
    .from('pool_performance_records')
    .insert({
      product_id: entry.product_id,
      performance_date: entry.performance_date,
      period_start: entry.period_start,
      period_end: entry.period_end,
      total_pool_value: entry.total_pool_value,
      total_returns: entry.total_returns,
      return_rate: entry.return_rate,
      expense_ratio: expenseRatio,
      net_distributable: netDistributable,
      distributed_amount: 0,
      is_distributed: false,
      entered_by: entry.entered_by,
      source_description: entry.source_description,
      supporting_notes: entry.supporting_notes || null,
      source_reference: entry.source_reference || null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to record pool performance: ${error.message}`);

  return data as PoolPerformanceRecord;
}

/**
 * Get pool performance records for a product.
 */
export async function getPoolPerformanceRecords(productId: string): Promise<PoolPerformanceRecord[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('pool_performance_records')
    .select('*')
    .eq('product_id', productId)
    .order('performance_date', { ascending: false });
  if (error) throw new Error(`Failed to get pool performance records: ${error.message}`);
  return (data || []) as PoolPerformanceRecord[];
}

/**
 * Distribute pool returns to contributors — proportionally.
 * 
 * This is the DISTRIBUTION MECHANISM:
 * 1. Gets all active investment accounts for the pool product
 * 2. Calculates each contributor's proportional share of the pool
 * 3. Posts distribution through the Orchestrator (payout to wallet or reinvest)
 * 4. Records individual distribution records
 * 5. Marks the performance record as distributed
 * 
 * Proportional share = contributor's current_value / total_pool_value
 * 
 * This reuses Phase 7's proportional distribution pattern from group savings.
 */
export async function distributePoolReturns(
  performanceRecordId: string,
  distributedBy: string,
): Promise<DistributionResult> {
  const supabase = getServiceClient();

  try {
    // Get the performance record
    const { data: perfRecord, error: perfError } = await supabase
      .from('pool_performance_records')
      .select('*')
      .eq('id', performanceRecordId)
      .single();
    if (perfError || !perfRecord) return { success: false, performance_record_id: performanceRecordId, total_distributed: 0, contributor_count: 0, distributions: [], error: 'Performance record not found' };
    if (perfRecord.is_distributed) return { success: false, performance_record_id: performanceRecordId, total_distributed: 0, contributor_count: 0, distributions: [], error: 'Performance record already distributed' };

    const netDistributable = Number(perfRecord.net_distributable);
    if (netDistributable <= 0) return { success: false, performance_record_id: performanceRecordId, total_distributed: 0, contributor_count: 0, distributions: [], error: 'Net distributable is zero or negative' };

    // Get all active investment accounts for this product
    const { data: accounts, error: accountsError } = await supabase
      .from('investment_accounts')
      .select('id, customer_id, current_value, terms_snapshot')
      .eq('product_id', perfRecord.product_id)
      .eq('status', 'active');
    if (accountsError) return { success: false, performance_record_id: performanceRecordId, total_distributed: 0, contributor_count: 0, distributions: [], error: `Failed to get accounts: ${accountsError.message}` };

    if (!accounts || accounts.length === 0) {
      return { success: false, performance_record_id: performanceRecordId, total_distributed: 0, contributor_count: 0, distributions: [], error: 'No active investment accounts for this pool product' };
    }

    // Calculate total pool value (sum of all contributors' current values)
    const totalPoolValue = accounts.reduce((sum, acc) => sum + Number(acc.current_value), 0);
    if (totalPoolValue <= 0) return { success: false, performance_record_id: performanceRecordId, total_distributed: 0, contributor_count: 0, distributions: [], error: 'Total pool value is zero' };

    // Get the investment product for auto_reinvest setting
    const { data: product } = await supabase
      .from('investment_products')
      .select('product_name')
      .eq('id', perfRecord.product_id)
      .single();

    const distributions: PoolDistribution[] = [];
    let totalDistributed = 0;

    for (const account of accounts) {
      const currentValue = Number(account.current_value);
      const poolShare = currentValue / totalPoolValue;
      const distributedAmount = Math.round(netDistributable * poolShare * 100) / 100;

      if (distributedAmount <= 0) continue;

      // Determine if payout or reinvest based on account's auto_revest setting
      const terms = account.terms_snapshot as Record<string, unknown>;
      const autoReinvest = terms.auto_reinvest as boolean || false;

      // Look up investment ledger account
      const { data: ledgerAccountId } = await supabase.rpc('get_investment_account_id', {
        p_investment_account_id: account.id,
      });

      let ftResult;
      let distributionType: 'payout' | 'reinvest';

      if (autoReinvest && ledgerAccountId) {
        // Reinvest: D Interest Expense, C Investment Settlement
        ftResult = await initiate({
          transaction_type: 'investment_reinvest',
          source_module: 'investments',
          source_reference: `pool_distribution:${performanceRecordId}:${account.id}`,
          amount: distributedAmount,
          currency: 'NGN',
          description: `Pool returns reinvested: ${product?.product_name || ''}`,
          idempotency_key: `pool_dist_reinvest:${performanceRecordId}:${account.id}`,
          product_account_id: ledgerAccountId as string,
          metadata: {
            pool_performance_record_id: performanceRecordId,
            pool_share: poolShare,
            investment_account_id: account.id,
          },
        });
        distributionType = 'reinvest';
      } else {
        // Payout to wallet: need the customer's wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('id')
          .eq('customer_id', account.customer_id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (!wallet) {
          // Skip — can't pay out without a wallet. Record as undistributed.
          continue;
        }

        ftResult = await initiate({
          transaction_type: 'investment_returns',
          source_module: 'investments',
          source_reference: `pool_distribution:${performanceRecordId}:${account.id}`,
          amount: distributedAmount,
          currency: 'NGN',
          description: `Pool returns payout: ${product?.product_name || ''}`,
          idempotency_key: `pool_dist_payout:${performanceRecordId}:${account.id}`,
          wallet_id: wallet.id,
          metadata: {
            pool_performance_record_id: performanceRecordId,
            pool_share: poolShare,
            investment_account_id: account.id,
          },
        });
        distributionType = 'payout';
      }

      if (ftResult.status === 'failed') {
        // Log and skip — don't fail the entire distribution for one account
        console.error(`Failed to distribute to account ${account.id}: ${ftResult.error}`);
        continue;
      }

      // Record the distribution
      const { data: distRecord } = await supabase
        .from('pool_distributions')
        .insert({
          performance_record_id: performanceRecordId,
          investment_account_id: account.id,
          customer_id: account.customer_id,
          pool_share: Math.round(poolShare * 1000000) / 1000000,
          distributed_amount: distributedAmount,
          distribution_type: distributionType,
          financial_transaction_id: ftResult.id,
          distributed_by: distributedBy,
        })
        .select('*')
        .single();

      if (distRecord) distributions.push(distRecord as PoolDistribution);

      // Update the investment account
      if (distributionType === 'reinvest') {
        const newValue = currentValue + distributedAmount;
        await supabase.from('investment_accounts').update({
          current_value: newValue,
          returns_earned: Number(account.returns_earned || 0) + distributedAmount,
          last_valuation_date: new Date().toISOString(),
        }).eq('id', account.id);
      } else {
        await supabase.from('investment_accounts').update({
          returns_earned: Number(account.returns_earned || 0) + distributedAmount,
          returns_paid_out: Number(account.returns_paid_out || 0) + distributedAmount,
          last_valuation_date: new Date().toISOString(),
        }).eq('id', account.id);
      }

      // Record investment transaction
      await supabase.from('investment_transactions').insert({
        investment_account_id: account.id,
        customer_id: account.customer_id,
        transaction_type: distributionType === 'reinvest' ? 'returns_reinvest' : 'returns_payout',
        amount: distributedAmount,
        financial_transaction_id: ftResult.id,
        source_reference: ftResult.transaction_reference,
        status: 'completed',
        metadata: {
          pool_performance_record_id: performanceRecordId,
          pool_share: poolShare,
          distribution_type: distributionType,
        },
      });

      totalDistributed += distributedAmount;
    }

    // Mark the performance record as distributed
    await supabase.from('pool_performance_records').update({
      is_distributed: true,
      distributed_at: new Date().toISOString(),
      distributed_amount: totalDistributed,
    }).eq('id', performanceRecordId);

    return {
      success: true,
      performance_record_id: performanceRecordId,
      total_distributed: totalDistributed,
      contributor_count: distributions.length,
      distributions,
    };
  } catch (error) {
    return {
      success: false,
      performance_record_id: performanceRecordId,
      total_distributed: 0,
      contributor_count: 0,
      distributions: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get distributions for a specific performance record.
 */
export async function getPoolDistributions(performanceRecordId: string): Promise<PoolDistribution[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('pool_distributions')
    .select('*')
    .eq('performance_record_id', performanceRecordId)
    .order('distributed_at', { ascending: false });
  if (error) throw new Error(`Failed to get pool distributions: ${error.message}`);
  return (data || []) as PoolDistribution[];
}

/**
 * Get all distributions for a customer (across all pool products).
 */
export async function getCustomerPoolDistributions(customerId: string): Promise<PoolDistribution[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('pool_distributions')
    .select('*')
    .eq('customer_id', customerId)
    .order('distributed_at', { ascending: false });
  if (error) throw new Error(`Failed to get customer pool distributions: ${error.message}`);
  return (data || []) as PoolDistribution[];
}
