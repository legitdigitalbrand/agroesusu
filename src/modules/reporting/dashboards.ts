// ============================================================================
// Operational Dashboards
// 
// Real-time queries against the Ledger and module data.
// 
// Refresh strategy: REAL-TIME for operational dashboards.
// Rationale: The platform is in sandbox with small data volumes. For production
// at 1M users, these queries would be backed by read replicas or materialized
// views refreshed every 5-15 minutes. But the principle is: operational
// dashboards can tolerate slight staleness (seconds to minutes) — they show
// "what's happening now" not "what's the audited truth."
// 
// COMPLIANCE reports (separate module) use a different strategy: they query
// the Ledger directly and document exact source traceability.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type {
  OperationalDashboard, PortfolioSummary, LoanPortfolioReport,
  SavingsPortfolioReport, InvestmentPortfolioReport, ProductBreakdown,
  InvestmentProductBreakdown,
} from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Get the balance of a parent account and all its children from the Ledger.
 * This is the REAL source of truth for financial balances.
 * 
 * For liability parents (2000, 2001, 2003, 2005): balance = credits - debits
 * For asset parents (1002): balance = debits - credits
 */
async function getAccountTreeBalance(parentCode: string): Promise<number> {
  const supabase = getServiceClient();
  // Get all child accounts under this parent
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, account_type')
    .or(`account_code.eq.${parentCode},account_code.like.${parentCode}.%`)
    .eq('is_active', true);
  if (error || !accounts) return 0;

  let total = 0;
  for (const account of accounts) {
    const { data: balance } = await supabase.rpc('get_account_balance', { p_account_id: account.id });
    total += Number(balance) || 0;
  }
  return total;
}

/**
 * Portfolio Summary — the top-level financial health view.
 * ALL numbers are traceable to the Ledger (the immutable system of record).
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const [
    totalWallets, totalSavings, totalInvestments,
    totalGroupSavings, totalLoans,
    interestExpense, interestRevenue, feeRevenue,
  ] = await Promise.all([
    getAccountTreeBalance('2000'),  // Customer Wallet Accounts
    getAccountTreeBalance('2001'),  // Savings Holding Accounts
    getAccountTreeBalance('2003'),  // Investment Settlement Accounts
    getAccountTreeBalance('2005'),  // Group Savings Pools
    getAccountTreeBalance('1002'),  // Loan Receivables
    getAccountTreeBalance('5000'),  // Interest Expense
    getAccountTreeBalance('4001'),  // Interest Revenue
    getAccountTreeBalance('4000'),  // Fee Revenue
  ]);

  return {
    total_wallet_balances: totalWallets,
    total_savings: totalSavings,
    total_investments: totalInvestments,
    total_group_savings: totalGroupSavings,
    total_loans_outstanding: totalLoans,
    total_customer_deposits: totalWallets + totalSavings + totalInvestments + totalGroupSavings,
    total_interest_expense: interestExpense,
    total_interest_revenue: interestRevenue,
    total_fee_revenue: feeRevenue,
    snapshot_date: new Date().toISOString().split('T')[0],
  };
}

/**
 * Loan Portfolio Report — operational view of loan health.
 */
export async function getLoanPortfolio(): Promise<LoanPortfolioReport> {
  const supabase = getServiceClient();

  // Get loan summary stats
  const { data: loanStats } = await supabase
    .from('loans')
    .select('id, status, principal_amount, outstanding_balance, product_id')
    .in('status', ['active', 'disbursed', 'overdue', 'defaulted']);

  const activeLoans = (loanStats || []).filter(l => l.status === 'active' || l.status === 'disbursed');
  const overdueLoans = (loanStats || []).filter(l => l.status === 'overdue');
  const defaultLoans = (loanStats || []).filter(l => l.status === 'defaulted');

  const totalDisbursed = activeLoans.reduce((s, l) => s + Number(l.principal_amount), 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);
  const totalOverdue = overdueLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  // Group by product
  const productIds = [...new Set((loanStats || []).map(l => l.product_id))];
  const byProduct: ProductBreakdown[] = [];
  
  for (const productId of productIds) {
    const { data: product } = await supabase
      .from('loan_products')
      .select('product_code, product_name')
      .eq('id', productId)
      .maybeSingle();
    
    const productLoans = (loanStats || []).filter(l => l.product_id === productId);
    byProduct.push({
      product_code: product?.product_code || 'UNKNOWN',
      product_name: product?.product_name || 'Unknown Product',
      active_count: productLoans.filter(l => l.status === 'active' || l.status === 'disbursed').length,
      total_amount: productLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0),
      overdue_amount: productLoans.filter(l => l.status === 'overdue').reduce((s, l) => s + Number(l.outstanding_balance || 0), 0),
      overdue_count: productLoans.filter(l => l.status === 'overdue').length,
    });
  }

  const totalActive = activeLoans.length + overdueLoans.length + defaultLoans.length;
  const defaultRate = totalActive > 0 ? (defaultLoans.length / totalActive) * 100 : 0;

  return {
    total_active_loans: totalActive,
    total_disbursed: totalDisbursed,
    total_repaid: totalDisbursed - totalOutstanding,
    total_outstanding: totalOutstanding,
    total_overdue: totalOverdue,
    overdue_count: overdueLoans.length,
    default_count: defaultLoans.length,
    default_rate: Math.round(defaultRate * 100) / 100,
    by_product: byProduct,
  };
}

/**
 * Savings Portfolio Report — operational view of savings health.
 */
export async function getSavingsPortfolio(): Promise<SavingsPortfolioReport> {
  const supabase = getServiceClient();

  const { data: accounts } = await supabase
    .from('savings_accounts')
    .select('id, product_id, status')
    .eq('status', 'active');

  // Get savings balance from Ledger
  const totalBalance = await getAccountTreeBalance('2001');

  // Get interest paid (from financial_transactions)
  const { data: interestTxs } = await supabase
    .from('financial_transactions')
    .select('amount')
    .eq('transaction_type', 'savings_interest')
    .eq('status', 'completed');
  const totalInterestPaid = (interestTxs || []).reduce((s, t) => s + Number(t.amount), 0);

  // Group by product
  const productIds = [...new Set((accounts || []).map(a => a.product_id))];
  const byProduct: ProductBreakdown[] = [];

  for (const productId of productIds) {
    const { data: product } = await supabase
      .from('savings_products')
      .select('product_code, product_name')
      .eq('id', productId)
      .maybeSingle();

    const productAccounts = (accounts || []).filter(a => a.product_id === productId);
    byProduct.push({
      product_code: product?.product_code || 'UNKNOWN',
      product_name: product?.product_name || 'Unknown Product',
      active_count: productAccounts.length,
      total_amount: 0,  // Would need per-account ledger balance — skip for now
      overdue_amount: 0,
      overdue_count: 0,
    });
  }

  return {
    total_active_accounts: (accounts || []).length,
    total_balance: totalBalance,
    total_interest_paid: totalInterestPaid,
    by_product: byProduct,
  };
}

/**
 * Investment Portfolio Report — operational view of investment health.
 * 
 * CRITICAL: Guaranteed and variable_pool returns are shown SEPARATELY.
 * They are NEVER blended into one misleading aggregate.
 */
export async function getInvestmentPortfolio(): Promise<InvestmentPortfolioReport> {
  const supabase = getServiceClient();

  const { data: accounts } = await supabase
    .from('investment_accounts')
    .select('id, product_id, current_value, status, terms_snapshot')
    .eq('status', 'active');

  // Get products for return_guarantee classification
  const productIds = [...new Set((accounts || []).map(a => a.product_id))];
  const { data: products } = await supabase
    .from('investment_products')
    .select('id, product_code, product_name, return_guarantee, expected_return_rate')
    .in('id', productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000']);

  const productMap = new Map((products || []).map(p => [p.id, p]));

  // Classify AUM by return guarantee type
  let guaranteedAUM = 0, variablePoolAUM = 0, expectedAUM = 0;
  const byProductMap = new Map<string, InvestmentProductBreakdown>();

  for (const account of (accounts || [])) {
    const product = productMap.get(account.product_id);
    if (!product) continue;

    const value = Number(account.current_value);
    if (product.return_guarantee === 'guaranteed') guaranteedAUM += value;
    else if (product.return_guarantee === 'variable_pool') variablePoolAUM += value;
    else expectedAUM += value;

    // Per-product breakdown
    if (!byProductMap.has(product.id)) {
      byProductMap.set(product.id, {
        product_code: product.product_code,
        product_name: product.product_name,
        active_count: 0,
        total_amount: 0,
        overdue_amount: 0,
        overdue_count: 0,
        return_guarantee: product.return_guarantee,
        expected_return_rate: Number(product.expected_return_rate),
        returns_paid: 0,
      });
    }
    const bp = byProductMap.get(product.id)!;
    bp.active_count++;
    bp.total_amount += value;
  }

  // Get returns paid — SEPARATED by guarantee type
  const { data: returnsTxs } = await supabase
    .from('investment_transactions')
    .select('amount, investment_account_id')
    .in('transaction_type', ['returns_payout', 'returns_reinvest']);

  let guaranteedReturns = 0, variableReturns = 0;
  for (const tx of (returnsTxs || [])) {
    const { data: account } = await supabase
      .from('investment_accounts')
      .select('product_id')
      .eq('id', tx.investment_account_id)
      .maybeSingle();
    if (account) {
      const product = productMap.get(account.product_id);
      if (product?.return_guarantee === 'guaranteed') guaranteedReturns += Number(tx.amount);
      else if (product?.return_guarantee === 'variable_pool') variableReturns += Number(tx.amount);
      else guaranteedReturns += Number(tx.amount); // 'expected' treated like guaranteed for returns accounting
    }
  }

  return {
    total_active_accounts: (accounts || []).length,
    total_aum: guaranteedAUM + variablePoolAUM + expectedAUM,
    guaranteed_aum: guaranteedAUM,
    variable_pool_aum: variablePoolAUM,
    expected_aum: expectedAUM,
    guaranteed_returns_paid: guaranteedReturns,
    variable_pool_returns_distributed: variableReturns,
    by_product: Array.from(byProductMap.values()),
  };
}

/**
 * Full Operational Dashboard — top-level view for Super Admin / Operations.
 */
export async function getOperationalDashboard(): Promise<OperationalDashboard> {
  const supabase = getServiceClient();

  const [portfolio, loans, savings, investments] = await Promise.all([
    getPortfolioSummary(),
    getLoanPortfolio(),
    getSavingsPortfolio(),
    getInvestmentPortfolio(),
  ]);

  // Group savings
  const { count: activeGroups } = await supabase
    .from('group_savings_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  const totalGroupBalance = await getAccountTreeBalance('2005');
  const { count: activeEsusu } = await supabase
    .from('esusu_groups')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Cooperative
  const { count: totalCoops } = await supabase
    .from('cooperatives')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  const { count: totalMembers } = await supabase
    .from('cooperative_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  const { count: pendingResolutions } = await supabase
    .from('cooperative_resolutions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return {
    portfolio,
    loans,
    savings,
    investments,
    group_savings: {
      active_groups: activeGroups || 0,
      total_group_balance: totalGroupBalance,
      active_esusu_cycles: activeEsusu || 0,
    },
    cooperative: {
      total_cooperatives: totalCoops || 0,
      total_members: totalMembers || 0,
      pending_resolutions: pendingResolutions || 0,
    },
    generated_at: new Date().toISOString(),
  };
}
