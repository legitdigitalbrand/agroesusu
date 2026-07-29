// ============================================================================
// Savings History Signal Computation
// 
// Pre-computes savings behavior metrics for Phase 6 (Loan Engine) credit
// scoring. This is the raw signal — Phase 6 computes the final credit score.
// 
// The signal captures:
//   - Consistency: how regular are contributions?
//   - Stability: how stable is the balance? (low withdrawal rate)
//   - Tenure: how long has the customer been saving?
//   - Volume: total balance, average balance, interest earned
// 
// Phase 6 will use these signals for "up to 3× savings balance" eligibility
// and internal credit scoring.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getAccountBalance } from '@/modules/ledger';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Compute and store the savings history signal for a single customer.
 * Called by a daily scheduled job.
 */
export async function computeSavingsSignal(customerId: string): Promise<void> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // 1. Get all active savings accounts for this customer
  const { data: accounts, error } = await supabase
    .from('savings_accounts')
    .select(`
      id, account_number, status, opened_at, product_id, total_interest_earned,
      product_terms_snapshot, created_at,
      savings_products (product_type)
    `)
    .eq('customer_id', customerId)
    .in('status', ['active', 'matured']);

  if (error || !accounts || accounts.length === 0) {
    // No active savings — still record a signal (all zeros)
    await supabase.from('savings_history_signals').upsert({
      customer_id: customerId,
      snapshot_date: today,
      total_savings_balance: 0,
      active_account_count: 0,
      product_diversity: 0,
      savings_tenure_days: 0,
      contribution_count_30d: 0,
      contribution_count_90d: 0,
      avg_balance_30d: 0,
      avg_balance_90d: 0,
      withdrawal_count_90d: 0,
      total_interest_earned: 0,
      consistency_score: 0,
      stability_score: 0,
      tenure_score: 0,
    }, { onConflict: 'customer_id,snapshot_date' });
    return;
  }

  // 2. Compute total balance from Ledger
  let totalBalance = 0;
  const productTypes = new Set<string>();

  for (const account of accounts) {
    const { data: ledgerAccountId } = await supabase.rpc('get_savings_account_id', {
      p_savings_account_id: account.id,
    });
    if (ledgerAccountId) {
      totalBalance += await getAccountBalance(ledgerAccountId as string);
    }
    if ((account as { savings_products?: { product_type?: string } }).savings_products) {
      productTypes.add((account as unknown as { savings_products: { product_type: string } }).savings_products.product_type);
    }
  }

  // 3. Compute tenure (days since earliest savings account)
  const earliestDate = accounts.reduce((earliest: Date | null, acc) => {
    const openedAt = acc.opened_at || acc.created_at;
    const date = new Date(openedAt);
    return earliest === null || date < earliest ? date : earliest;
  }, null);

  const tenureDays = earliestDate
    ? Math.floor((Date.now() - earliestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // 4. Count contributions and withdrawals from financial_transactions
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { count: contributions30d } = await supabase
    .from('financial_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('source_module', 'savings')
    .in('transaction_type', ['savings_contribution'])
    .gte('created_at', thirtyDaysAgo.toISOString())
    .in('wallet_id', (await supabase.from('wallets').select('id').eq('customer_id', customerId).then(r => r.data?.map(w => w.id) || [])));

  const { count: contributions90d } = await supabase
    .from('financial_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('source_module', 'savings')
    .in('transaction_type', ['savings_contribution'])
    .gte('created_at', ninetyDaysAgo.toISOString());

  const { count: withdrawals90d } = await supabase
    .from('financial_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('source_module', 'savings')
    .in('transaction_type', ['savings_withdrawal'])
    .gte('created_at', ninetyDaysAgo.toISOString());

  // 5. Compute total interest earned
  const totalInterest = accounts.reduce((sum: number, acc) => {
    return sum + Number(acc.total_interest_earned || 0);
  }, 0);

  // 6. Compute derived scores (0-100)
  // Consistency: based on contribution frequency (30d)
  // - 0 contributions = 0, 1-2 = 25, 3-5 = 50, 6-10 = 75, 10+ = 100
  const consistencyScore = Math.min(100, Math.round(((contributions30d || 0) / 10) * 100));

  // Stability: based on withdrawal rate vs contributions
  // - 0 withdrawals = 100, high withdrawal rate = low score
  const totalTx90d = (contributions90d || 0) + (withdrawals90d || 0);
  const withdrawalRate = totalTx90d > 0 ? (withdrawals90d || 0) / totalTx90d : 0;
  const stabilityScore = Math.round((1 - Math.min(1, withdrawalRate)) * 100);

  // Tenure: based on days of savings history
  // - 0 days = 0, 30 days = 25, 90 days = 50, 180 days = 75, 365+ = 100
  const tenureScore = Math.min(100, Math.round((tenureDays / 365) * 100));

  // 7. Store the signal
  await supabase.from('savings_history_signals').upsert({
    customer_id: customerId,
    snapshot_date: today,
    total_savings_balance: totalBalance,
    active_account_count: accounts.length,
    product_diversity: productTypes.size,
    savings_tenure_days: tenureDays,
    contribution_count_30d: contributions30d || 0,
    contribution_count_90d: contributions90d || 0,
    avg_balance_30d: totalBalance,  // Simplified — Phase 6 can refine
    avg_balance_90d: totalBalance,
    withdrawal_count_90d: withdrawals90d || 0,
    total_interest_earned: totalInterest,
    consistency_score: consistencyScore,
    stability_score: stabilityScore,
    tenure_score: tenureScore,
  }, { onConflict: 'customer_id,snapshot_date' });
}

/**
 * Compute savings signals for ALL customers.
 * Called by a daily scheduled job.
 */
export async function computeAllSavingsSignals(): Promise<{ processed: number }> {
  const supabase = getServiceClient();

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id')
    .eq('status', 'active');

  if (error) throw new Error(`Failed to fetch customers: ${error.message}`);

  let processed = 0;
  for (const customer of (customers || [])) {
    await computeSavingsSignal(customer.id);
    processed++;
  }

  return { processed };
}

/**
 * Get the latest savings signal for a customer.
 * Phase 6 (Loan Engine) will call this to evaluate loan eligibility.
 */
export async function getLatestSignal(customerId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('savings_history_signals')
    .select('*')
    .eq('customer_id', customerId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to get signal: ${error.message}`);
  return data;
}
