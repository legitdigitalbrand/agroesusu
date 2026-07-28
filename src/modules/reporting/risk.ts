// ============================================================================
// Risk & Portfolio Views
// 
// Read-only aggregations for risk assessment:
//   - Default rate by loan product
//   - Savings-to-loan ratio (portfolio health)
//   - Investment pool performance (guaranteed vs. variable shown SEPARATELY)
//   - Credit score distribution
// 
// NOT new decisioning logic — these are OBSERVATIONS, not inputs to decisions.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { RiskReport, ProductBreakdown } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Risk & Portfolio Report — aggregated risk views.
 * 
 * SOURCE TRACEABILITY:
 *   - Default rates: loans table (operational state) cross-referenced with
 *     loan_products for product classification
 *   - Savings-to-loan ratio: Ledger account tree balances (2001 / 1002)
 *   - Credit scores: customer_risk_profiles table (Phase 6)
 *   - Investment performance: pool_performance_records + investment_accounts
 *     (guaranteed and variable_pool returns shown SEPARATELY)
 */
export async function getRiskReport(): Promise<RiskReport> {
  const supabase = getServiceClient();

  // Default rate by product
  const { data: loans } = await supabase
    .from('loans')
    .select('id, product_id, status, outstanding_balance')
    .in('status', ['active', 'disbursed', 'overdue', 'defaulted']);

  const productIds = [...new Set((loans || []).map(l => l.product_id))];
  const { data: products } = await supabase
    .from('loan_products')
    .select('id, product_code, product_name')
    .in('id', productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000']);
  const productMap = new Map((products || []).map(p => [p.id, p]));

  const byProductMap = new Map<string, ProductBreakdown>();
  for (const loan of (loans || [])) {
    const product = productMap.get(loan.product_id);
    if (!product) continue;
    
    if (!byProductMap.has(product.id)) {
      byProductMap.set(product.id, {
        product_code: product.product_code,
        product_name: product.product_name,
        active_count: 0,
        total_amount: 0,
        overdue_amount: 0,
        overdue_count: 0,
      });
    }
    const bp = byProductMap.get(product.id)!;
    bp.active_count++;
    bp.total_amount += Number(loan.outstanding_balance || 0);
    if (loan.status === 'overdue' || loan.status === 'defaulted') {
      bp.overdue_amount += Number(loan.outstanding_balance || 0);
      bp.overdue_count++;
    }
  }

  // Savings-to-loan ratio from the Ledger
  async function getTreeBalance(code: string): Promise<number> {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .or(`account_code.eq.${code},account_code.like.${code}.%`)
      .eq('is_active', true);
    let total = 0;
    for (const a of (accounts || [])) {
      const { data } = await supabase.rpc('get_account_balance', { p_account_id: a.id });
      total += Number(data) || 0;
    }
    return total;
  }

  const [totalSavings, totalLoans] = await Promise.all([
    getTreeBalance('2001'),
    getTreeBalance('1002'),
  ]);

  const savingsToLoanRatio = totalLoans > 0 ? totalSavings / totalLoans : 0;

  // Credit score distribution
  const { data: riskProfiles } = await supabase
    .from('customer_risk_profiles')
    .select('credit_score');

  const creditScoreDistribution = {
    range_300_579: 0,
    range_580_669: 0,
    range_670_739: 0,
    range_740_799: 0,
    range_800_850: 0,
  };

  for (const profile of (riskProfiles || [])) {
    const score = Number((profile as { credit_score: number }).credit_score) || 0;
    if (score < 580) creditScoreDistribution.range_300_579++;
    else if (score < 670) creditScoreDistribution.range_580_669++;
    else if (score < 740) creditScoreDistribution.range_670_739++;
    else if (score < 800) creditScoreDistribution.range_740_799++;
    else creditScoreDistribution.range_800_850++;
  }

  return {
    default_rate_by_product: Array.from(byProductMap.values()),
    savings_to_loan_ratio: Math.round(savingsToLoanRatio * 100) / 100,
    total_savings: totalSavings,
    total_loans: totalLoans,
    credit_score_distribution: creditScoreDistribution,
  };
}

/**
 * Investment Pool Performance Summary — respects Phase 8's fixed-vs-variable distinction.
 * 
 * CRITICAL: Guaranteed and variable_pool returns are NEVER blended.
 * This report shows them in separate sections with clear labels.
 * 
 * Returns:
 *   - guaranteed_products: AUM and returns for guaranteed products
 *   - variable_pool_products: AUM, pool performance records, and distributions
 *   - expected_products: AUM and returns for expected-return products
 *   - WARNING: Do NOT sum guaranteed and variable returns into one number
 */
export async function getInvestmentPoolPerformance(): Promise<{
  guaranteed: { products: { code: string; name: string; aum: number; returns_paid: number }[] };
  variable_pool: { products: { code: string; name: string; aum: number; performance_records: number; total_returns: number; distributed: number }[] };
  expected: { products: { code: string; name: string; aum: number; returns_paid: number }[] };
  warning: string;
}> {
  const supabase = getServiceClient();

  const { data: products } = await supabase
    .from('investment_products')
    .select('id, product_code, product_name, return_guarantee')
    .eq('is_active', true);

  const guaranteed: { code: string; name: string; aum: number; returns_paid: number }[] = [];
  const variablePool: { code: string; name: string; aum: number; performance_records: number; total_returns: number; distributed: number }[] = [];
  const expected: { code: string; name: string; aum: number; returns_paid: number }[] = [];

  for (const product of (products || [])) {
    const { data: accounts } = await supabase
      .from('investment_accounts')
      .select('current_value')
      .eq('product_id', product.id)
      .eq('status', 'active');
    const aum = (accounts || []).reduce((s, a) => s + Number(a.current_value), 0);

    if (product.return_guarantee === 'guaranteed') {
      const { data: txs } = await supabase
        .from('investment_transactions')
        .select('amount')
        .eq('transaction_type', 'returns_payout')
        .in('investment_account_id', (accounts || []).map(a => a.id) || ['00000000-0000-0000-0000-000000000000']);
      guaranteed.push({
        code: product.product_code,
        name: product.product_name,
        aum,
        returns_paid: (txs || []).reduce((s, t) => s + Number(t.amount), 0),
      });
    } else if (product.return_guarantee === 'variable_pool') {
      const { data: perfRecords } = await supabase
        .from('pool_performance_records')
        .select('total_returns, distributed_amount, is_distributed')
        .eq('product_id', product.id);
      variablePool.push({
        code: product.product_code,
        name: product.product_name,
        aum,
        performance_records: (perfRecords || []).length,
        total_returns: (perfRecords || []).reduce((s, r) => s + Number(r.total_returns), 0),
        distributed: (perfRecords || []).reduce((s, r) => s + Number(r.distributed_amount), 0),
      });
    } else {
      expected.push({
        code: product.product_code,
        name: product.product_name,
        aum,
        returns_paid: 0,
      });
    }
  }

  return {
    guaranteed: { products: guaranteed },
    variable_pool: { products: variablePool },
    expected: { products: expected },
    warning: 'Guaranteed and variable_pool returns are shown SEPARATELY. Do NOT sum them into one aggregate without clear labeling. Variable pool returns depend on actual performance and are NOT contractual.',
  };
}
