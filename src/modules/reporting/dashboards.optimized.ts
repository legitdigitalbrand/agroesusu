// ============================================================================
// Operational Dashboards (Optimized)
//
// Real-time queries against the Ledger and module data.
// Optimizations applied:
//   - Batch queries for account tree balance calculations (1 query instead of N RPC calls)
//   - Supabase joins for product breakdowns (loans, savings, investments)
//   - In-memory caching for expensive portfolio aggregations with short TTL
//   - Elimination of transaction-to-account loop in investment portfolio
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

// In-memory cache for operational dashboard aggregations (TTL: 15 seconds)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const reportCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 15_000;

function getCached<T>(key: string): T | null {
  const entry = reportCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  reportCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Batch calculate balances for multiple parent account codes in 2 single DB queries.
 * Replaces N+1 getAccountTreeBalance / RPC calls.
 */
export async function getBatchAccountTreeBalances(parentCodes: string[]): Promise<Map<string, number>> {
  const supabase = getServiceClient();
  const balances = new Map<string, number>();
  parentCodes.forEach(code => balances.set(code, 0));

  if (parentCodes.length === 0) return balances;

  // Build OR condition for parent codes and child codes
  const orConditions = parentCodes.map(code => `account_code.eq.${code},account_code.like.${code}.%`).join(',');

  // 1. Single query to fetch all matching accounts
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('id, account_code, account_type')
    .or(orConditions)
    .eq('is_active', true);

  if (accError || !accounts || accounts.length === 0) {
    return balances;
  }

  const accountIds = accounts.map(a => a.id);
  const accountMap = new Map(accounts.map(a => [a.id, a]));

  // Map each account back to its root parent code
  function getParentCodeForAccount(code: string): string | null {
    for (const parent of parentCodes) {
      if (code === parent || code.startsWith(`${parent}.`)) {
        return parent;
      }
    }
    return null;
  }

  // 2. Single query to fetch all posted/reversed journal lines for all matching accounts
  const { data: lines, error: linesError } = await supabase
    .from('journal_lines')
    .select('account_id, entry_type, amount, journal_entries!inner(status)')
    .in('account_id', accountIds)
    .in('journal_entries.status', ['posted', 'reversed']);

  if (linesError || !lines) {
    return balances;
  }

  for (const line of lines) {
    const account = accountMap.get(line.account_id);
    if (!account) continue;

    const rootParent = getParentCodeForAccount(account.account_code);
    if (!rootParent) continue;

    const amount = Number(line.amount) || 0;
    const isNormalDebit = account.account_type === 'asset' || account.account_type === 'expense';
    let lineContribution = 0;

    if (isNormalDebit) {
      lineContribution = line.entry_type === 'debit' ? amount : -amount;
    } else {
      lineContribution = line.entry_type === 'credit' ? amount : -amount;
    }

    balances.set(rootParent, (balances.get(rootParent) || 0) + lineContribution);
  }

  return balances;
}

/**
 * Get balance of a single parent account tree using the batch function.
 */
export async function getAccountTreeBalance(parentCode: string): Promise<number> {
  const balances = await getBatchAccountTreeBalances([parentCode]);
  return balances.get(parentCode) || 0;
}

/**
 * Portfolio Summary — top-level financial health view.
 * Traceable to the Ledger, optimized via batch account tree calculation.
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const cacheKey = 'portfolio_summary';
  const cached = getCached<PortfolioSummary>(cacheKey);
  if (cached) return cached;

  const codes = ['2000', '2001', '2003', '2005', '1002', '5000', '4001', '4000'];
  const balances = await getBatchAccountTreeBalances(codes);

  const totalWallets = balances.get('2000') || 0;
  const totalSavings = balances.get('2001') || 0;
  const totalInvestments = balances.get('2003') || 0;
  const totalGroupSavings = balances.get('2005') || 0;
  const totalLoans = balances.get('1002') || 0;
  const interestExpense = balances.get('5000') || 0;
  const interestRevenue = balances.get('4001') || 0;
  const feeRevenue = balances.get('4000') || 0;

  const result: PortfolioSummary = {
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

  setCache(cacheKey, result);
  return result;
}

/**
 * Loan Portfolio Report — operational view of loan health.
 * Optimized with Supabase joins and single-pass aggregation.
 */
export async function getLoanPortfolio(): Promise<LoanPortfolioReport> {
  const cacheKey = 'loan_portfolio';
  const cached = getCached<LoanPortfolioReport>(cacheKey);
  if (cached) return cached;

  const supabase = getServiceClient();

  // Query loans with join on loan_products in a single query
  const { data: loanStats, error } = await supabase
    .from('loans')
    .select('id, status, principal_amount, outstanding_balance, product_id, loan_products(product_code, product_name)')
    .in('status', ['active', 'disbursed', 'overdue', 'defaulted']);

  if (error) throw new Error(`Failed to fetch loan portfolio: ${error.message}`);

  const loans = loanStats || [];
  const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'disbursed');
  const overdueLoans = loans.filter(l => l.status === 'overdue');
  const defaultLoans = loans.filter(l => l.status === 'defaulted');

  const totalDisbursed = activeLoans.reduce((s, l) => s + Number(l.principal_amount || 0), 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);
  const totalOverdue = overdueLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  // Group by product in memory
  type LoanProductJoin = { product_code: string; product_name: string } | { product_code: string; product_name: string }[] | null;
  const productMap = new Map<string, { code: string; name: string; loans: typeof loans }>();

  for (const loan of loans) {
    const rawProd = loan.loan_products as LoanProductJoin;
    const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd;
    const code = prod?.product_code || 'UNKNOWN';
    const name = prod?.product_name || 'Unknown Product';
    const pId = loan.product_id;

    if (!productMap.has(pId)) {
      productMap.set(pId, { code, name, loans: [] });
    }
    productMap.get(pId)!.loans.push(loan);
  }

  const byProduct: ProductBreakdown[] = Array.from(productMap.values()).map(({ code, name, loans: pLoans }) => ({
    product_code: code,
    product_name: name,
    active_count: pLoans.filter(l => l.status === 'active' || l.status === 'disbursed').length,
    total_amount: pLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0),
    overdue_amount: pLoans.filter(l => l.status === 'overdue').reduce((s, l) => s + Number(l.outstanding_balance || 0), 0),
    overdue_count: pLoans.filter(l => l.status === 'overdue').length,
  }));

  const totalActive = activeLoans.length + overdueLoans.length + defaultLoans.length;
  const defaultRate = totalActive > 0 ? (defaultLoans.length / totalActive) * 100 : 0;

  const result: LoanPortfolioReport = {
    total_active_loans: totalActive,
    total_disbursed: totalDisbursed,
    total_repaid: Math.max(0, totalDisbursed - totalOutstanding),
    total_outstanding: totalOutstanding,
    total_overdue: totalOverdue,
    overdue_count: overdueLoans.length,
    default_count: defaultLoans.length,
    default_rate: Math.round(defaultRate * 100) / 100,
    by_product: byProduct,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Savings Portfolio Report — operational view of savings health.
 * Optimized with Supabase joins and batch ledger calculation.
 */
export async function getSavingsPortfolio(): Promise<SavingsPortfolioReport> {
  const cacheKey = 'savings_portfolio';
  const cached = getCached<SavingsPortfolioReport>(cacheKey);
  if (cached) return cached;

  const supabase = getServiceClient();

  // Parallel query execution: accounts with product join, tree balance, and interest transactions
  const [{ data: accounts }, totalBalance, { data: interestTxs }] = await Promise.all([
    supabase
      .from('savings_accounts')
      .select('id, product_id, status, savings_products(product_code, product_name)')
      .eq('status', 'active'),
    getAccountTreeBalance('2001'),
    supabase
      .from('financial_transactions')
      .select('amount')
      .eq('transaction_type', 'savings_interest')
      .eq('status', 'completed'),
  ]);

  const totalInterestPaid = (interestTxs || []).reduce((s, t) => s + Number(t.amount || 0), 0);

  // Group by product in memory
  type ProductJoin = { product_code: string; product_name: string } | { product_code: string; product_name: string }[] | null;
  const productMap = new Map<string, { code: string; name: string; count: number }>();

  for (const acc of (accounts || [])) {
    const rawProd = acc.savings_products as ProductJoin;
    const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd;
    const code = prod?.product_code || 'UNKNOWN';
    const name = prod?.product_name || 'Unknown Product';
    const pId = acc.product_id;

    if (!productMap.has(pId)) {
      productMap.set(pId, { code, name, count: 0 });
    }
    productMap.get(pId)!.count++;
  }

  const byProduct: ProductBreakdown[] = Array.from(productMap.values()).map(({ code, name, count }) => ({
    product_code: code,
    product_name: name,
    active_count: count,
    total_amount: 0,
    overdue_amount: 0,
    overdue_count: 0,
  }));

  const result: SavingsPortfolioReport = {
    total_active_accounts: (accounts || []).length,
    total_balance: totalBalance,
    total_interest_paid: totalInterestPaid,
    by_product: byProduct,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Investment Portfolio Report — operational view of investment health.
 * Optimized with batch queries and inner joins on investment_accounts.
 */
export async function getInvestmentPortfolio(): Promise<InvestmentPortfolioReport> {
  const cacheKey = 'investment_portfolio';
  const cached = getCached<InvestmentPortfolioReport>(cacheKey);
  if (cached) return cached;

  const supabase = getServiceClient();

  // 1. Fetch active accounts
  const { data: accounts } = await supabase
    .from('investment_accounts')
    .select('id, product_id, current_value, status, terms_snapshot')
    .eq('status', 'active');

  const activeAccounts = accounts || [];
  const productIds = [...new Set(activeAccounts.map(a => a.product_id))];

  // 2. Fetch products and returns transactions in parallel
  const [{ data: products }, { data: returnsTxs }] = await Promise.all([
    supabase
      .from('investment_products')
      .select('id, product_code, product_name, return_guarantee, expected_return_rate')
      .in('id', productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000']),
    supabase
      .from('investment_transactions')
      .select('amount, investment_account_id, investment_accounts!inner(product_id)')
      .in('transaction_type', ['returns_payout', 'returns_reinvest']),
  ]);

  const productMap = new Map((products || []).map(p => [p.id, p]));

  let guaranteedAUM = 0;
  let variablePoolAUM = 0;
  let expectedAUM = 0;
  const byProductMap = new Map<string, InvestmentProductBreakdown>();

  for (const account of activeAccounts) {
    const product = productMap.get(account.product_id);
    if (!product) continue;

    const value = Number(account.current_value) || 0;
    if (product.return_guarantee === 'guaranteed') guaranteedAUM += value;
    else if (product.return_guarantee === 'variable_pool') variablePoolAUM += value;
    else expectedAUM += value;

    if (!byProductMap.has(product.id)) {
      byProductMap.set(product.id, {
        product_code: product.product_code,
        product_name: product.product_name,
        active_count: 0,
        total_amount: 0,
        overdue_amount: 0,
        overdue_count: 0,
        return_guarantee: product.return_guarantee,
        expected_return_rate: Number(product.expected_return_rate) || 0,
        returns_paid: 0,
      });
    }
    const bp = byProductMap.get(product.id)!;
    bp.active_count++;
    bp.total_amount += value;
  }

  // 3. Process returns without per-transaction account queries
  let guaranteedReturns = 0;
  let variableReturns = 0;

  type InvAccJoin = { product_id: string } | { product_id: string }[] | null;

  for (const tx of (returnsTxs || [])) {
    const rawAcc = tx.investment_accounts as InvAccJoin;
    const acc = Array.isArray(rawAcc) ? rawAcc[0] : rawAcc;
    if (!acc) continue;

    const product = productMap.get(acc.product_id);
    const amount = Number(tx.amount) || 0;

    if (product?.return_guarantee === 'guaranteed') guaranteedReturns += amount;
    else if (product?.return_guarantee === 'variable_pool') variableReturns += amount;
    else guaranteedReturns += amount;
  }

  const result: InvestmentPortfolioReport = {
    total_active_accounts: activeAccounts.length,
    total_aum: guaranteedAUM + variablePoolAUM + expectedAUM,
    guaranteed_aum: guaranteedAUM,
    variable_pool_aum: variablePoolAUM,
    expected_aum: expectedAUM,
    guaranteed_returns_paid: guaranteedReturns,
    variable_pool_returns_distributed: variableReturns,
    by_product: Array.from(byProductMap.values()),
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Full Operational Dashboard — top-level view for Super Admin / Operations.
 * Optimized with batch execution and cached sub-reports.
 */
export async function getOperationalDashboard(): Promise<OperationalDashboard> {
  const supabase = getServiceClient();

  const [
    portfolio, loans, savings, investments,
    totalGroupBalance,
    { count: activeGroups },
    { count: activeEsusu },
    { count: totalCoops },
    { count: totalMembers },
    { count: pendingResolutions },
  ] = await Promise.all([
    getPortfolioSummary(),
    getLoanPortfolio(),
    getSavingsPortfolio(),
    getInvestmentPortfolio(),
    getAccountTreeBalance('2005'),
    supabase.from('group_savings_accounts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('esusu_groups').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('cooperatives').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('cooperative_memberships').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('cooperative_resolutions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

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
