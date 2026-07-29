// ============================================================================
// Interest Accrual Engine
// 
// Scheduled job that calculates and posts interest for all active savings
// accounts based on their product's interest configuration.
// 
// Interest is a financial transaction — it posts through the Orchestrator
// like any other movement. No direct ledger writes, no special-cased
// balance bumps.
// 
// Calculation methods:
//   flat:     interest = principal × (annualRate / 365) × daysElapsed
//   compound: interest = principal × ((1 + annualRate/365)^daysElapsed - 1)
// 
// Cadence:
//   daily:    Accrue every day (rate / 365 per day)
//   monthly:  Accrue every 30 days (rate / 12 per month)
//   maturity: Accrue only at maturity (full term interest)
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { getAccountBalance } from '@/modules/ledger';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface AccrualResult {
  account_id: string;
  account_number: string;
  interest_amount: number;
  posted: boolean;
  error?: string;
}

/**
 * Calculate interest for an account based on its terms.
 * 
 * @param principal Current savings balance from the Ledger
 * @param annualRate Annual interest rate (e.g., 5.0 = 5%)
 * @param method 'flat' or 'compound'
 * @param daysElapsed Days since last accrual
 * @returns Interest amount
 */
export function calculateInterest(
  principal: number,
  annualRate: number,
  method: 'flat' | 'compound',
  daysElapsed: number
): number {
  if (principal <= 0 || annualRate <= 0 || daysElapsed <= 0) return 0;

  if (method === 'flat') {
    // Simple interest: P × R × T
    return (principal * (annualRate / 100) * daysElapsed) / 365;
  }

  if (method === 'compound') {
    // Daily compounding: P × ((1 + r/365)^n - 1)
    const dailyRate = annualRate / 100 / 365;
    return principal * (Math.pow(1 + dailyRate, daysElapsed) - 1);
  }

  return 0;
}

/**
 * Accrue interest for a single savings account.
 * 
 * 1. Get the account and its terms
 * 2. Check if it's due for accrual (based on cadence)
 * 3. Calculate interest from the Ledger balance
 * 4. Post through the Orchestrator (savings_interest type)
 * 5. Update the account's interest tracking
 */
export async function accrueInterest(accountId: string): Promise<AccrualResult> {
  const supabase = getServiceClient();

  try {
    // 1. Fetch the account
    const { data: account, error } = await supabase
      .from('savings_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      return { account_id: accountId, account_number: 'unknown', interest_amount: 0, posted: false, error: 'Account not found' };
    }

    if (account.status !== 'active') {
      return { account_id: accountId, account_number: account.account_number, interest_amount: 0, posted: false, error: `Account is ${account.status}, not active` };
    }

    // 2. Get terms from snapshot
    const terms = account.product_terms_snapshot as {
      interest_rate: number;
      interest_method: 'flat' | 'compound';
      interest_cadence: 'daily' | 'monthly' | 'maturity';
    };

    if (terms.interest_rate <= 0) {
      return { account_id: accountId, account_number: account.account_number, interest_amount: 0, posted: false, error: 'No interest rate configured' };
    }

    // 3. Check if accrual is due
    const now = new Date();
    const lastAccrual = account.last_interest_accrued_at ? new Date(account.last_interest_accrued_at) : null;
    const nextAccrual = account.next_accrual_at ? new Date(account.next_accrual_at) : null;

    if (nextAccrual && now < nextAccrual) {
      return { account_id: accountId, account_number: account.account_number, interest_amount: 0, posted: false, error: 'Not due for accrual yet' };
    }

    // Calculate days elapsed since last accrual (or since account opened)
    const startDate = lastAccrual || account.opened_at || now.toISOString();
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));

    // For maturity cadence, only accrue if maturity date has passed
    if (terms.interest_cadence === 'maturity') {
      if (!account.maturity_date || new Date(account.maturity_date) > now) {
        return { account_id: accountId, account_number: account.account_number, interest_amount: 0, posted: false, error: 'Maturity not reached yet' };
      }
    }

    // 4. Get the current balance from the Ledger
    const { data: ledgerAccountId } = await supabase.rpc('get_savings_account_id', {
      p_savings_account_id: accountId,
    });

    if (!ledgerAccountId) {
      return { account_id: accountId, account_number: account.account_number, interest_amount: 0, posted: false, error: 'Ledger account not found' };
    }

    const principal = await getAccountBalance(ledgerAccountId as string);
    if (principal <= 0) {
      return { account_id: accountId, account_number: account.account_number, interest_amount: 0, posted: false, error: 'No balance to accrue interest on' };
    }

    // 5. Calculate interest
    const interestAmount = calculateInterest(
      principal,
      terms.interest_rate,
      terms.interest_method,
      daysElapsed
    );

    // Round to 2 decimal places, minimum 1 kobo
    const roundedInterest = Math.max(0.01, Math.round(interestAmount * 100) / 100);

    if (roundedInterest < 0.01) {
      return { account_id: accountId, account_number: account.account_number, interest_amount: 0, posted: false, error: 'Interest too small to post' };
    }

    // 6. Post through the Orchestrator
    const result = await initiate({
      transaction_type: 'savings_interest',
      source_module: 'savings',
      source_reference: accountId,
      amount: roundedInterest,
      currency: 'NGN',
      description: `Interest accrual for ${account.account_number} (${daysElapsed} days @ ${terms.interest_rate}%)`,
      idempotency_key: `savings_interest:${accountId}:${now.toISOString().split('T')[0]}`,
      wallet_id: account.wallet_id,
      product_account_id: ledgerAccountId as string,
      metadata: {
        savings_account_id: accountId,
        principal,
        rate: terms.interest_rate,
        method: terms.interest_method,
        days_elapsed: daysElapsed,
      },
    });

    if (result.status === 'failed') {
      return { account_id: accountId, account_number: account.account_number, interest_amount: roundedInterest, posted: false, error: result.error };
    }

    // 7. Update the account's interest tracking
    const nextAccrualDate = new Date();
    if (terms.interest_cadence === 'daily') {
      nextAccrualDate.setDate(nextAccrualDate.getDate() + 1);
    } else if (terms.interest_cadence === 'monthly') {
      nextAccrualDate.setDate(nextAccrualDate.getDate() + 30);
    } else {
      // maturity — no next accrual
      nextAccrualDate.setFullYear(nextAccrualDate.getFullYear() + 1); // far future
    }

    await supabase
      .from('savings_accounts')
      .update({
        total_interest_earned: Number(account.total_interest_earned) + roundedInterest,
        last_interest_accrued_at: now.toISOString(),
        next_accrual_at: nextAccrualDate.toISOString(),
      })
      .eq('id', accountId);

    return {
      account_id: accountId,
      account_number: account.account_number,
      interest_amount: roundedInterest,
      posted: true,
    };

  } catch (error) {
    console.error('[Savings:accrueInterest] Error:', error);
    return {
      account_id: accountId,
      account_number: 'unknown',
      interest_amount: 0,
      posted: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Accrue interest for ALL active savings accounts.
 * Called by the Vercel cron job (daily).
 */
export async function accrueInterestForAllAccounts(): Promise<{
  processed: number;
  posted: number;
  skipped: number;
  failed: number;
  results: AccrualResult[];
}> {
  const supabase = getServiceClient();

  // Get all active accounts that are due for accrual
  const { data: accounts, error } = await supabase
    .from('savings_accounts')
    .select('id')
    .eq('status', 'active')
    .or(`next_accrual_at.is.null,next_accrual_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch accounts for accrual: ${error.message}`);

  const results: AccrualResult[] = [];
  let posted = 0, skipped = 0, failed = 0;

  for (const account of (accounts || [])) {
    const result = await accrueInterest(account.id);
    results.push(result);
    if (result.posted) posted++;
    else if (result.error) failed++;
    else skipped++;
  }

  return {
    processed: (accounts || []).length,
    posted,
    skipped,
    failed,
    results,
  };
}
