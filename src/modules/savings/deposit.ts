// ============================================================================
// Savings Deposit Flow
// 
// Validates a deposit against product rules, then calls the Orchestrator
// to post the financial transaction. The Orchestrator handles:
//   - Creating the journal entry (Debit Wallet, Credit Savings)
//   - Posting to the Ledger (validates zero-sum)
//   - Creating the wallet_transactions read model entry
//   - Refreshing the wallet balance cache
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { getAccount, activateAccount, reactivateAccount } from './accounts';
import type { DepositRequest } from './types';

/**
 * Deposit failure codes (returned alongside `error` so the UI can react
 * specifically — e.g. `insufficient_wallet_balance` shows a top-up CTA).
 */
export type DepositFailureCode =
  | 'invalid_amount'
  | 'account_closed'
  | 'insufficient_wallet_balance'
  | 'below_minimum'
  | 'ledger_setup'
  | 'orchestrator';

export interface DepositResult {
  success: boolean;
  transaction_reference?: string;
  error?: string;
  code?: DepositFailureCode;
  details?: {
    required?: number;   // amount needed (wallet pre-check)
    available?: number;  // wallet balance available now
    shortfall?: number;  // required - available
    minimum?: number;    // product minimum deposit
  };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Process a savings deposit.
 * 
 * Flow:
 * 1. Fetch the savings account and validate it's active (or activate if pending)
 * 2. Validate the deposit amount against product rules
 * 3. Look up the savings account's ledger account ID
 * 4. Call Orchestrator.initiate() with savings_contribution type
 * 5. The Orchestrator posts: Debit Wallet, Credit Savings Account
 */
export async function deposit(request: DepositRequest): Promise<DepositResult> {
  const supabase = getServiceClient();

  try {
    // ── Validation order matters (2026-09-11 incident feedback):
    //    1. amount shape          → 'invalid_amount'
    //    2. account truly closed  → 'account_closed'
    //    3. wallet balance        → 'insufficient_wallet_balance' (checked
    //                               BEFORE product minimums so an empty wallet
    //                               always yields the actionable top-up message)
    //    4. product minimum
    // Only 'closed' blocks deposits: a 'withdrawn' (emptied) flexible pot is
    // re-opened by the deposit itself.

    if (!request.amount || request.amount <= 0) {
      return { success: false, code: 'invalid_amount', error: 'Deposit amount must be greater than 0' };
    }

    // 1. Fetch the savings account
    const account = await getAccount(request.savings_account_id);
    if (!account) return { success: false, error: 'Savings account not found' };

    if (account.status === 'closed') {
      return {
        success: false,
        code: 'account_closed',
        error: 'This savings account is closed. Open a new one to continue saving.',
      };
    }

    // A withdrawn FIXED deposit is finished — no re-opening; open a new one.
    if (account.status === 'withdrawn' && account.product?.product_type === 'fixed_deposit') {
      return {
        success: false,
        code: 'account_closed',
        error: 'This fixed deposit has been fully withdrawn. Open a new fixed deposit to continue.',
      };
    }

    // 2. Wallet pre-check: deposits ALWAYS move money from the Main Wallet.
    //    Read the wallet read-model cache (cached_available_balance, migration
    //    00007) — same source the transfer pre-flight uses. The orchestrator's
    //    own sufficient-funds guard remains the hard enforcement; this earlier
    //    check gives the user a clean, structured failure instead.
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('cached_available_balance, cached_balance, status')
      .eq('id', request.wallet_id)
      .maybeSingle();
    const walletAvailable = Number(walletRow?.cached_available_balance ?? walletRow?.cached_balance ?? 0);
    if (request.amount > walletAvailable) {
      return {
        success: false,
        code: 'insufficient_wallet_balance',
        error: `Insufficient balance on your Main Wallet. ₦${request.amount.toLocaleString('en-NG')} required, ₦${Math.max(walletAvailable, 0).toLocaleString('en-NG')} available.`,
        details: {
          required: request.amount,
          available: Math.max(walletAvailable, 0),
          shortfall: Math.max(request.amount - walletAvailable, 0),
        },
      };
    }

    // 3. Re-open a withdrawn flexible pot (depositing brings it back to life)
    if (account.status === 'withdrawn') {
      await reactivateAccount(request.savings_account_id);
    }
    // If pending, activate it (first deposit activates the account)
    if (account.status === 'pending') {
      await activateAccount(request.savings_account_id);
    }

    // 4. Validate against product rules (from the terms snapshot)
    const terms = account.product_terms_snapshot as {
      minimum_deposit: number;
      maximum_deposit: number | null;
      minimum_balance: number;
    };

    // Use the product's minimum_deposit from the snapshot, or fallback to a default
    const minDeposit = terms.minimum_deposit || 100;
    if (request.amount < minDeposit) {
      return {
        success: false,
        code: 'below_minimum',
        error: `Minimum deposit is ₦${minDeposit}`,
        details: { minimum: minDeposit },
      };
    }

    // 3. Look up the savings account's ledger account ID
    const { data: ledgerAccountId, error: ledgerError } = await supabase.rpc(
      'get_savings_account_id',
      { p_savings_account_id: request.savings_account_id }
    );

    if (ledgerError || !ledgerAccountId) {
      return {
        success: false,
        code: 'ledger_setup',
        error: 'Savings ledger account not found (account may not be active yet)',
      };
    }

    // 4. Call the Orchestrator
    const result = await initiate({
      transaction_type: 'savings_contribution',
      source_module: 'savings',
      source_reference: request.savings_account_id,
      amount: request.amount,
      currency: 'NGN',
      description: request.description || `Savings deposit to ${account.account_number}`,
      idempotency_key: `savings_deposit:${request.savings_account_id}:${Date.now()}`,
      wallet_id: request.wallet_id,
      product_account_id: ledgerAccountId as string,
      metadata: {
        savings_account_id: request.savings_account_id,
        product_id: account.product_id,
      },
    });

    if (result.status === 'failed') {
      return {
        success: false,
        code: 'orchestrator',
        error: result.error || 'Orchestrator failed to process deposit',
      };
    }

    return { success: true, transaction_reference: result.transaction_reference };

  } catch (error) {
    console.error('[Savings:deposit] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
