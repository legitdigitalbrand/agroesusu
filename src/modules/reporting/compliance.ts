// ============================================================================
// Compliance & Regulatory Reports
// 
// These reports have a HIGHER BAR for traceability than operational dashboards.
// Every figure must be able to answer: "which ledger entries produced this number?"
// 
// Strategy: ON-DEMAND. These reports are generated when needed (not real-time
// dashboards) because they need to be point-in-time accurate and fully traceable.
// Each report documents its exact source tables and ledger accounts.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type {
  ComplianceDepositsReport, ComplianceLoansReport,
  ReconciliationReport, KYCStatusReport,
} from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Total Deposits Held — compliance report.
 * 
 * SOURCE TRACEABILITY:
 *   Total customer deposits = sum of all liability account balances under:
 *     - 2000 (Customer Wallet Accounts)
 *     - 2001 (Savings Holding Accounts)
 *     - 2003 (Investment Settlement Accounts)
 *     - 2005 (Group Savings Pools)
 *   
 *   Each balance is calculated from journal_lines (immutable double-entry records):
 *     For liabilities: balance = SUM(credits) - SUM(debits)
 *   
 *   This number can be reconstructed at any time by querying:
 *     SELECT get_account_balance(id) FROM accounts WHERE account_code LIKE '2000.%' OR ...
 *   
 *   The operational counts (number of accounts) come from the module tables
 *   (savings_accounts, investment_accounts, etc.) — these are operational state,
 *   not financial state. The FINANCIAL figure (total deposits) comes from the Ledger.
 */
export async function getComplianceDepositsReport(): Promise<ComplianceDepositsReport> {
  const supabase = getServiceClient();

  // Get account counts from module tables (operational state)
  const { count: walletCount } = await supabase.from('wallets').select('*', { count: 'exact', head: true }).eq('status', 'active');
  const { count: savingsCount } = await supabase.from('savings_accounts').select('*', { count: 'exact', head: true }).eq('status', 'active');
  const { count: investmentCount } = await supabase.from('investment_accounts').select('*', { count: 'exact', head: true }).in('status', ['active', 'matured']);
  const { count: groupCount } = await supabase.from('group_savings_accounts').select('*', { count: 'exact', head: true }).eq('status', 'active');

  // Get FINANCIAL balances from the Ledger (the system of record)
  // Each of these calls the get_account_balance SQL function, which sums journal_lines
  async function getTreeBalance(parentCode: string): Promise<number> {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .or(`account_code.eq.${parentCode},account_code.like.${parentCode}.%`)
      .eq('is_active', true);
    let total = 0;
    for (const a of (accounts || [])) {
      const { data } = await supabase.rpc('get_account_balance', { p_account_id: a.id });
      total += Number(data) || 0;
    }
    return total;
  }

  const [balance2000, balance2001, balance2003, balance2005] = await Promise.all([
    getTreeBalance('2000'), getTreeBalance('2001'), getTreeBalance('2003'), getTreeBalance('2005'),
  ]);

  return {
    total_wallets: walletCount || 0,
    total_wallet_balance: balance2000,
    total_savings_accounts: savingsCount || 0,
    total_savings_balance: balance2001,
    total_investment_accounts: investmentCount || 0,
    total_investment_balance: balance2003,
    total_group_savings: groupCount || 0,
    total_group_savings_balance: balance2005,
    grand_total_deposits: balance2000 + balance2001 + balance2003 + balance2005,
    // Ledger traceability — these are the exact ledger account balances
    ledger_account_2000_balance: balance2000,
    ledger_account_2001_balance: balance2001,
    ledger_account_2003_balance: balance2003,
    ledger_account_2005_balance: balance2005,
    ledger_total_liabilities: balance2000 + balance2001 + balance2003 + balance2005,
  };
}

/**
 * Total Loans Outstanding — compliance report.
 * 
 * SOURCE TRACEABILITY:
 *   Total loans outstanding = balance of asset accounts under 1002 (Loan Receivables)
 *   
 *   For assets: balance = SUM(debits) - SUM(credits)
 *   
 *   Disbursing a loan: D 1002.{loan_account}, C 2002.{loan_settlement}
 *   Repaying a loan: D 2002.{loan_settlement}, C 1002.{loan_account}
 *   
 *   So 1002 balance = total disbursed - total repaid = outstanding.
 *   
 *   This can be reconstructed by:
 *     SELECT get_account_balance(id) FROM accounts WHERE account_code LIKE '1002.%'
 */
export async function getComplianceLoansReport(): Promise<ComplianceLoansReport> {
  const supabase = getServiceClient();

  // Get operational loan counts
  const { data: loans } = await supabase
    .from('loans')
    .select('id, principal_amount, outstanding_balance, status')
    .in('status', ['active', 'disbursed', 'overdue']);

  const totalDisbursed = (loans || []).reduce((s, l) => s + Number(l.principal_amount), 0);
  const totalOutstanding = (loans || []).reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  // Get overdue from operational data
  const { data: overdueLoans } = await supabase
    .from('loans')
    .select('outstanding_balance')
    .eq('status', 'overdue');
  const totalOverdue = (overdueLoans || []).reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  // Get FINANCIAL balance from the Ledger
  const { data: loanAccounts } = await supabase
    .from('accounts')
    .select('id')
    .or('account_code.eq.1002,account_code.like.1002.%')
    .eq('is_active', true);
  let ledgerLoanBalance = 0;
  for (const a of (loanAccounts || [])) {
    const { data } = await supabase.rpc('get_account_balance', { p_account_id: a.id });
    ledgerLoanBalance += Number(data) || 0;
  }

  return {
    total_active_loans: (loans || []).length,
    total_disbursed: totalDisbursed,
    total_outstanding: totalOutstanding,
    total_overdue: totalOverdue,
    ledger_account_1002_balance: ledgerLoanBalance,
    ledger_total_loan_assets: ledgerLoanBalance,
  };
}

/**
 * Reconciliation Status Report — builds on Phase 3's reconciliation mechanism.
 * 
 * SOURCE TRACEABILITY:
 *   reconciliation_flags table — created by the daily reconciliation cron job
 *   (Phase 3) comparing wallet_transactions against Safe Haven settlement data.
 *   
 *   Each flag has: status (matched/unmatched/flagged/resolved/pending),
 *   wallet_transaction_id, and resolution metadata.
 */
export async function getReconciliationReport(): Promise<ReconciliationReport> {
  const supabase = getServiceClient();

  const { data: flags, count: totalCount } = await supabase
    .from('reconciliation_flags')
    .select('*', { count: 'exact' });

  const statusCounts = {
    total_transactions: totalCount || 0,
    matched: 0,
    unmatched: 0,
    flagged: 0,
    resolved: 0,
    pending: 0,
  };

  for (const flag of (flags || [])) {
    const status = (flag as { status: string }).status;
    if (status in statusCounts) {
      (statusCounts as Record<string, number>)[status]++;
    }
  }

  return statusCounts;
}

/**
 * KYC Status Report — compliance view of customer verification.
 * 
 * SOURCE TRACEABILITY:
 *   customers table — kyc_level field (set during onboarding/KYC process)
 *   
 *   KYC levels:
 *     0 = unverified (registered but no KYC)
 *     1 = basic (email/phone verified, basic info)
 *     2 = standard (BVN verified, ID document submitted)
 *     3 = enhanced (full verification, address proof, etc.)
 */
export async function getKYCStatusReport(): Promise<KYCStatusReport> {
  const supabase = getServiceClient();

  const { data: customers } = await supabase
    .from('customers')
    .select('kyc_level, kyc_status');

  const report: KYCStatusReport = {
    total_customers: (customers || []).length,
    level_1: 0,
    level_2: 0,
    level_3: 0,
    unverified: 0,
    pending_review: 0,
  };

  for (const c of (customers || [])) {
    const kycLevel = (c as { kyc_level: number }).kyc_level || 0;
    const kycStatus = (c as { kyc_status: string }).kyc_status || 'unverified';
    
    if (kycStatus === 'pending') report.pending_review++;
    if (kycLevel === 0) report.unverified++;
    else if (kycLevel === 1) report.level_1++;
    else if (kycLevel === 2) report.level_2++;
    else if (kycLevel >= 3) report.level_3++;
  }

  return report;
}
