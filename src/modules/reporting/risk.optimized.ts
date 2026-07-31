// ============================================================================
// Risk & Portfolio Views (Optimized)
//
// Read-only aggregations for risk assessment.
// Optimizations applied:
//   - Batch queries replacing per-product loop iterations in pool performance
//   - Supabase joins for loan product default rate classification
//   - Parallel range count queries for credit score distribution
//   - Strict separation of guaranteed vs variable pool returns (never blended)
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { RiskReport, ProductBreakdown } from './types';
import { getBatchAccountTreeBalances } from './dashboards.optimized';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Risk & Portfolio Report — aggregated risk views.
 * Traceable to operational state and Ledger tree balances.
 */
export async function getRiskReport(): Promise<RiskReport> {
  const supabase = getServiceClient();

  // 1. Fetch loans with join on loan_products in a single query
  const { data: loans } = await supabase
    .from('loans')
    .select('id, product_id, status, outstanding_balance, loan_products(id, product_code, product_name)')
    .in('status', ['active', 'disbursed', 'overdue', 'defaulted']);

  type ProductJoin = { id: string; product_code: string; product_name: string } | { id: string; product_code: string; product_name: string }[] | null;
  const byProductMap = new Map<string, ProductBreakdown>();

  for (const loan of (loans || [])) {
    const rawProd = loan.loan_products as ProductJoin;
    const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd;
    if (!prod) continue;

    const pId = prod.id;
    if (!byProductMap.has(pId)) {
      byProductMap.set(pId, {
        product_code: prod.product_code,
        product_name: prod.product_name,
        active_count: 0,
        total_amount: 0,
        overdue_amount: 0,
        overdue_count: 0,
      });
    }

    const bp = byProductMap.get(pId)!;
    bp.active_count++;
    bp.total_amount += Number(loan.outstanding_balance || 0);

    if (loan.status === 'overdue' || loan.status === 'defaulted') {
      bp.overdue_amount += Number(loan.outstanding_balance || 0);
      bp.overdue_count++;
    }
  }

  // 2. Fetch Ledger balances for savings and loans in batch
  const balances = await getBatchAccountTreeBalances(['2001', '1002']);
  const totalSavings = balances.get('2001') || 0;
  const totalLoans = balances.get('1002') || 0;
  const savingsToLoanRatio = totalLoans > 0 ? totalSavings / totalLoans : 0;

  // 3. Parallel range counts for credit score distribution (head: true, 0 payload)
  const [
    { count: r300_579 },
    { count: r580_669 },
    { count: r670_739 },
    { count: r740_799 },
    { count: r800_850 },
  ] = await Promise.all([
    supabase.from('customer_risk_profiles').select('*', { count: 'exact', head: true }).gte('credit_score', 300).lt('credit_score', 580),
    supabase.from('customer_risk_profiles').select('*', { count: 'exact', head: true }).gte('credit_score', 580).lt('credit_score', 670),
    supabase.from('customer_risk_profiles').select('*', { count: 'exact', head: true }).gte('credit_score', 670).lt('credit_score', 740),
    supabase.from('customer_risk_profiles').select('*', { count: 'exact', head: true }).gte('credit_score', 740).lt('credit_score', 800),
    supabase.from('customer_risk_profiles').select('*', { count: 'exact', head: true }).gte('credit_score', 800).lte('credit_score', 850),
  ]);

  return {
    default_rate_by_product: Array.from(byProductMap.values()),
    savings_to_loan_ratio: Math.round(savingsToLoanRatio * 100) / 100,
    total_savings: totalSavings,
    total_loans: totalLoans,
    credit_score_distribution: {
      range_300_579: r300_579 || 0,
      range_580_669: r580_669 || 0,
      range_670_739: r670_739 || 0,
      range_740_799: r740_799 || 0,
      range_800_850: r800_850 || 0,
    },
  };
}

/**
 * Investment Pool Performance Summary — respects Phase 8's fixed-vs-variable distinction.
 * Replaces nested per-product queries with 4 batch queries total.
 */
export async function getInvestmentPoolPerformance(): Promise<{
  guaranteed: { products: { code: string; name: string; aum: number; returns_paid: number }[] };
  variable_pool: { products: { code: string; name: string; aum: number; performance_records: number; total_returns: number; distributed: number }[] };
  expected: { products: { code: string; name: string; aum: number; returns_paid: number }[] };
  warning: string;
}> {
  const supabase = getServiceClient();

  // 1. Fetch active products
  const { data: products } = await supabase
    .from('investment_products')
    .select('id, product_code, product_name, return_guarantee')
    .eq('is_active', true);

  const productList = products || [];
  if (productList.length === 0) {
    return {
      guaranteed: { products: [] },
      variable_pool: { products: [] },
      expected: { products: [] },
      warning: 'Guaranteed and variable_pool returns are shown SEPARATELY. Do NOT sum them into one aggregate without clear labeling. Variable pool returns depend on actual performance and are NOT contractual.',
    };
  }

  const productIds = productList.map(p => p.id);

  // 2. Execute batch queries for active accounts, returns transactions, and performance records
  const [{ data: accounts }, { data: returnsTxs }, { data: perfRecords }] = await Promise.all([
    supabase
      .from('investment_accounts')
      .select('id, product_id, current_value')
      .in('product_id', productIds)
      .eq('status', 'active'),
    supabase
      .from('investment_transactions')
      .select('amount, investment_account_id')
      .eq('transaction_type', 'returns_payout'),
    supabase
      .from('pool_performance_records')
      .select('product_id, total_returns, distributed_amount, is_distributed')
      .in('product_id', productIds),
  ]);

  // Build lookup structures in memory
  const accountToProduct = new Map<string, string>();
  const aumByProduct = new Map<string, number>();

  for (const acc of (accounts || [])) {
    accountToProduct.set(acc.id, acc.product_id);
    aumByProduct.set(acc.product_id, (aumByProduct.get(acc.product_id) || 0) + Number(acc.current_value || 0));
  }

  // Returns paid by product ID
  const returnsByProduct = new Map<string, number>();
  for (const tx of (returnsTxs || [])) {
    const pId = accountToProduct.get(tx.investment_account_id);
    if (pId) {
      returnsByProduct.set(pId, (returnsByProduct.get(pId) || 0) + Number(tx.amount || 0));
    }
  }

  // Performance records by product ID
  const perfByProduct = new Map<string, { count: number; totalReturns: number; distributed: number }>();
  for (const record of (perfRecords || [])) {
    const pId = record.product_id;
    if (!perfByProduct.has(pId)) {
      perfByProduct.set(pId, { count: 0, totalReturns: 0, distributed: 0 });
    }
    const entry = perfByProduct.get(pId)!;
    entry.count++;
    entry.totalReturns += Number(record.total_returns || 0);
    entry.distributed += Number(record.distributed_amount || 0);
  }

  // Assemble result collections
  const guaranteed: { code: string; name: string; aum: number; returns_paid: number }[] = [];
  const variablePool: { code: string; name: string; aum: number; performance_records: number; total_returns: number; distributed: number }[] = [];
  const expected: { code: string; name: string; aum: number; returns_paid: number }[] = [];

  for (const product of productList) {
    const aum = aumByProduct.get(product.id) || 0;

    if (product.return_guarantee === 'guaranteed') {
      guaranteed.push({
        code: product.product_code,
        name: product.product_name,
        aum,
        returns_paid: returnsByProduct.get(product.id) || 0,
      });
    } else if (product.return_guarantee === 'variable_pool') {
      const perf = perfByProduct.get(product.id) || { count: 0, totalReturns: 0, distributed: 0 };
      variablePool.push({
        code: product.product_code,
        name: product.product_name,
        aum,
        performance_records: perf.count,
        total_returns: perf.totalReturns,
        distributed: perf.distributed,
      });
    } else {
      expected.push({
        code: product.product_code,
        name: product.product_name,
        aum,
        returns_paid: returnsByProduct.get(product.id) || 0,
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
