// ============================================================================
// Compliance & Regulatory Reports (Optimized)
//
// On-demand, fully traceable compliance reports.
// Optimizations applied:
//   - Batch tree balance calculation (2 queries for all deposit ledger accounts)
//   - Parallel exact count queries (head: true) for reconciliation & KYC reports
//     (0 row payloads transferred over network)
//   - Elimination of duplicate/redundant database calls
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type {
  ComplianceDepositsReport, ComplianceLoansReport,
  ReconciliationReport, KYCStatusReport,
} from './types';
import { getBatchAccountTreeBalances } from './dashboards.optimized';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Total Deposits Held — compliance report.
 * Source traceable to Ledger accounts 2000, 2001, 2003, 2005 via batch queries.
 */
export async function getComplianceDepositsReport(): Promise<ComplianceDepositsReport> {
  const supabase = getServiceClient();

  // Run operational counts and batch ledger balance query in parallel
  const [
    { count: walletCount },
    { count: savingsCount },
    { count: investmentCount },
    { count: groupCount },
    balances,
  ] = await Promise.all([
    supabase.from('wallets').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('savings_accounts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('investment_accounts').select('*', { count: 'exact', head: true }).in('status', ['active', 'matured']),
    supabase.from('group_savings_accounts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    getBatchAccountTreeBalances(['2000', '2001', '2003', '2005']),
  ]);

  const balance2000 = balances.get('2000') || 0;
  const balance2001 = balances.get('2001') || 0;
  const balance2003 = balances.get('2003') || 0;
  const balance2005 = balances.get('2005') || 0;
  const grandTotal = balance2000 + balance2001 + balance2003 + balance2005;

  return {
    total_wallets: walletCount || 0,
    total_wallet_balance: balance2000,
    total_savings_accounts: savingsCount || 0,
    total_savings_balance: balance2001,
    total_investment_accounts: investmentCount || 0,
    total_investment_balance: balance2003,
    total_group_savings: groupCount || 0,
    total_group_savings_balance: balance2005,
    grand_total_deposits: grandTotal,
    // Ledger traceability
    ledger_account_2000_balance: balance2000,
    ledger_account_2001_balance: balance2001,
    ledger_account_2003_balance: balance2003,
    ledger_account_2005_balance: balance2005,
    ledger_total_liabilities: grandTotal,
  };
}

/**
 * Total Loans Outstanding — compliance report.
 * Source traceable to Ledger account 1002 via batch query.
 * Eliminates redundant query for overdue loans.
 */
export async function getComplianceLoansReport(): Promise<ComplianceLoansReport> {
  const supabase = getServiceClient();

  // Fetch operational loans and ledger balance in parallel
  const [{ data: loans }, balances] = await Promise.all([
    supabase
      .from('loans')
      .select('id, principal_amount, outstanding_balance, status')
      .in('status', ['active', 'disbursed', 'overdue']),
    getBatchAccountTreeBalances(['1002']),
  ]);

  const activeLoans = loans || [];
  const totalDisbursed = activeLoans.reduce((s, l) => s + Number(l.principal_amount || 0), 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  // Derived in memory from single query — no secondary API call needed
  const totalOverdue = activeLoans
    .filter(l => l.status === 'overdue')
    .reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  const ledgerLoanBalance = balances.get('1002') || 0;

  return {
    total_active_loans: activeLoans.length,
    total_disbursed: totalDisbursed,
    total_outstanding: totalOutstanding,
    total_overdue: totalOverdue,
    ledger_account_1002_balance: ledgerLoanBalance,
    ledger_total_loan_assets: ledgerLoanBalance,
  };
}

/**
 * Reconciliation Status Report — builds on Phase 3's reconciliation mechanism.
 * Uses parallel head counts to eliminate full table scan of reconciliation_flags.
 */
export async function getReconciliationReport(): Promise<ReconciliationReport> {
  const supabase = getServiceClient();

  const [
    { count: totalCount },
    { count: matchedCount },
    { count: unmatchedCount },
    { count: flaggedCount },
    { count: resolvedCount },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.from('reconciliation_flags').select('*', { count: 'exact', head: true }),
    supabase.from('reconciliation_flags').select('*', { count: 'exact', head: true }).eq('status', 'matched'),
    supabase.from('reconciliation_flags').select('*', { count: 'exact', head: true }).eq('status', 'unmatched'),
    supabase.from('reconciliation_flags').select('*', { count: 'exact', head: true }).eq('status', 'flagged'),
    supabase.from('reconciliation_flags').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    supabase.from('reconciliation_flags').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return {
    total_transactions: totalCount || 0,
    matched: matchedCount || 0,
    unmatched: unmatchedCount || 0,
    flagged: flaggedCount || 0,
    resolved: resolvedCount || 0,
    pending: pendingCount || 0,
  };
}

/**
 * KYC Status Report — compliance view of customer verification.
 * Uses parallel exact count queries to eliminate full table scan of customers.
 */
export async function getKYCStatusReport(): Promise<KYCStatusReport> {
  const supabase = getServiceClient();

  const [
    { count: totalCount },
    { count: pendingCount },
    { count: unverifiedCount },
    { count: level1Count },
    { count: level2Count },
    { count: level3Count },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
    supabase.from('customers').select('*', { count: 'exact', head: true }).or('kyc_level.eq.0,kyc_level.is.null'),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('kyc_level', 1),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('kyc_level', 2),
    supabase.from('customers').select('*', { count: 'exact', head: true }).gte('kyc_level', 3),
  ]);

  return {
    total_customers: totalCount || 0,
    level_1: level1Count || 0,
    level_2: level2Count || 0,
    level_3: level3Count || 0,
    unverified: unverifiedCount || 0,
    pending_review: pendingCount || 0,
  };
}
