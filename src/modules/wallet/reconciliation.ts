// ============================================================================
// Reconciliation Logic
// 
// Compares our recorded wallet balance (sum of confirmed transactions)
// against Safe Haven's actual account balance.
//
// CRITICAL RULE: Reconciliation discrepancies are NEVER auto-resolved by code.
// All mismatches go to the reconciliation_flags table for human review.
//
// Reconciliation runs:
//   - Scheduled: daily at 2 AM (Vercel cron)
//   - On-demand: admin triggers via API endpoint
//
// For now (no Safe Haven credentials), reconciliation checks:
//   - Does cached_balance == SUM(confirmed transactions)?
//   - This catches internal consistency bugs.
//
// When Safe Haven credentials are available, it will also:
//   - Fetch Safe Haven's actual balance via getAccountBalance()
//   - Compare our sum vs their reported balance
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { ReconciliationResult } from './types';
import { getBankingProvider } from '../integrations';
import { getAccountBalance, getWalletAccountId } from '../ledger';
import { sweepStaleWalletHolds } from './holds';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables for service client');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Tolerance for balance comparison (₦1.00 for rounding)
const RECONCILIATION_TOLERANCE = 1.00;

/**
 * Reconcile a single wallet.
 * 
 * Checks:
 * 1. Internal consistency: cached_balance == SUM(confirmed transactions)
 * 2. External consistency: our balance vs Safe Haven's reported balance (if credentials available)
 * 
 * If either check fails, a reconciliation_flag is created.
 */
export async function reconcileWallet(walletId: string): Promise<ReconciliationResult> {
  const supabase = getServiceClient();

  // 1. Get the wallet
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('id, wallet_number, account_number, safe_haven_account_id, cached_balance, customer_id')
    .eq('id', walletId)
    .single();

  if (walletError || !wallet) {
    return {
      wallet_id: walletId,
      our_balance: 0,
      sh_balance: null,
      discrepancy: null,
      status: 'error',
      error: 'Wallet not found',
    };
  }

  // 2. Compute our balance from the LEDGER — the declared source of financial
  //    record (migration 00015). The double-entry ledger is authoritative;
  //    the wallet_transactions read model is a derived projection.
  let ourBalance: number;
  const ledgerAccountId = await getWalletAccountId(walletId).catch(() => null);

  if (ledgerAccountId) {
    // Ledger-derived balance (account-type aware: liability = credits - debits)
    ourBalance = await getAccountBalance(ledgerAccountId);
  } else {
    // Fallback: wallet has no ledger account (pre-ledger wallet) — use the
    // confirmed read-model sum as before
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('direction, amount')
      .eq('wallet_id', walletId)
      .eq('status', 'confirmed');

    ourBalance = (transactions || []).reduce((sum, tx) => {
      return sum + (tx.direction === 'credit' ? tx.amount : -tx.amount);
    }, 0);
  }

  // 3. Internal consistency check: cached_balance vs computed sum
  const internalDiscrepancy = Math.abs(wallet.cached_balance - ourBalance);
  if (internalDiscrepancy > RECONCILIATION_TOLERANCE) {
    // Create a flag for internal inconsistency
    const { data: flag } = await supabase
      .from('reconciliation_flags')
      .insert({
        wallet_id: walletId,
        our_balance: ourBalance,
        sh_balance: wallet.cached_balance,
        discrepancy_amount: wallet.cached_balance - ourBalance,
        discrepancy_direction: wallet.cached_balance > ourBalance ? 'positive' : 'negative',
        status: 'open',
        metadata: {
          check_type: 'internal_consistency',
          cached_balance: wallet.cached_balance,
          computed_balance: ourBalance,
        },
      })
      .select('id')
      .single();

    return {
      wallet_id: walletId,
      our_balance: ourBalance,
      sh_balance: wallet.cached_balance,
      discrepancy: wallet.cached_balance - ourBalance,
      status: 'discrepancy',
      flag_id: flag?.id,
    };
  }

  // 4. External consistency check (only if Safe Haven credentials available)
  let shBalance: number | null = null;
  const provider = getBankingProvider();
  // Gate on REAL credential presence — the same condition the provider
  // factory uses to select the real adapter. A mis-set SAFE_HAVEN_ENV flag
  // can no longer silently disable external reconciliation, and mock mode
  // can no longer silently enable it.
  const hasCredentials = Boolean(
    process.env.SAFEHAVEN_CLIENT_ID &&
    process.env.SAFEHAVEN_PRIVATE_KEY
  );

  if (hasCredentials && wallet.safe_haven_account_id) {
    try {
      const balanceResult = await provider.getAccountBalance(wallet.safe_haven_account_id);
      shBalance = balanceResult.balance;
    } catch (err) {
      console.error(`[Reconciliation] Failed to fetch SH balance for wallet ${walletId}:`, err);
      // Don't fail — just skip external check and log
    }
  }

  if (shBalance !== null) {
    const externalDiscrepancy = ourBalance - shBalance;
    if (Math.abs(externalDiscrepancy) > RECONCILIATION_TOLERANCE) {
      // Create a flag for external discrepancy
      const { data: flag } = await supabase
        .from('reconciliation_flags')
        .insert({
          wallet_id: walletId,
          our_balance: ourBalance,
          sh_balance: shBalance,
          discrepancy_amount: externalDiscrepancy,
          discrepancy_direction: externalDiscrepancy > 0 ? 'positive' : 'negative',
          status: 'open',
          sh_response_snapshot: { balance: shBalance, account_id: wallet.safe_haven_account_id },
          metadata: { check_type: 'external_consistency' },
        })
        .select('id')
        .single();

      return {
        wallet_id: walletId,
        our_balance: ourBalance,
        sh_balance: shBalance,
        discrepancy: externalDiscrepancy,
        status: 'discrepancy',
        flag_id: flag?.id,
      };
    }
  }

  // 5. All good — update last reconciled timestamp
  await supabase
    .from('wallets')
    .update({ 
      cached_balance_updated_at: new Date().toISOString(),
    })
    .eq('id', walletId);

  return {
    wallet_id: walletId,
    our_balance: ourBalance,
    sh_balance: shBalance,
    discrepancy: null,
    status: 'matched',
  };
}

/**
 * Reconcile all active wallets.
 * Called by the cron job or on-demand by admin.
 */
export async function reconcileAllWallets(): Promise<ReconciliationResult[]> {
  const supabase = getServiceClient();

  // Gate 4 P0 #3: crash recovery — release wallet holds abandoned by dead
  // processes (funds locked in reserved_balance would never be released).
  try {
    const swept = await sweepStaleWalletHolds(15);
    if (swept > 0) console.warn(`[Reconciliation] Swept ${swept} stale wallet hold(s)`);
  } catch (sweepErr) {
    console.error('[Reconciliation] Stale hold sweep failed:', sweepErr);
  }

  // Get all active wallets with DVAs
  const { data: wallets, error } = await supabase
    .from('wallets')
    .select('id')
    .in('status', ['active'])
    .not('account_number', 'is', null)
    .limit(500); // Safety limit

  if (error) {
    throw new Error(`Failed to fetch wallets for reconciliation: ${error.message}`);
  }

  if (!wallets || wallets.length === 0) {
    return [];
  }

  const results: ReconciliationResult[] = [];

  // Reconcile each wallet (sequentially to avoid rate limits on SH API)
  for (const wallet of wallets) {
    try {
      const result = await reconcileWallet(wallet.id);
      results.push(result);
    } catch (err) {
      console.error(`[Reconciliation] Failed for wallet ${wallet.id}:`, err);
      results.push({
        wallet_id: wallet.id,
        our_balance: 0,
        sh_balance: null,
        discrepancy: null,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
