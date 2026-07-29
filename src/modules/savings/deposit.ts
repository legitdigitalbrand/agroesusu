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
import { getAccount, activateAccount } from './accounts';
import type { DepositRequest } from './types';

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
export async function deposit(request: DepositRequest): Promise<{
  success: boolean;
  transaction_reference?: string;
  error?: string;
}> {
  const supabase = getServiceClient();

  try {
    // 1. Fetch the savings account
    const account = await getAccount(request.savings_account_id);
    if (!account) return { success: false, error: 'Savings account not found' };

    if (account.status === 'closed' || account.status === 'withdrawn') {
      return { success: false, error: 'Cannot deposit into a closed account' };
    }

    // If pending, activate it (first deposit activates the account)
    if (account.status === 'pending') {
      await activateAccount(request.savings_account_id);
    }

    // 2. Validate against product rules (from the terms snapshot)
    const terms = account.product_terms_snapshot as {
      minimum_deposit: number;
      maximum_deposit: number | null;
      minimum_balance: number;
    };

    if (request.amount <= 0) {
      return { success: false, error: 'Deposit amount must be greater than 0' };
    }

    // Use the product's minimum_deposit from the snapshot, or fallback to a default
    const minDeposit = terms.minimum_deposit || 100;
    if (request.amount < minDeposit) {
      return { success: false, error: `Minimum deposit is ₦${minDeposit}` };
    }

    // 3. Look up the savings account's ledger account ID
    const { data: ledgerAccountId, error: ledgerError } = await supabase.rpc(
      'get_savings_account_id',
      { p_savings_account_id: request.savings_account_id }
    );

    if (ledgerError || !ledgerAccountId) {
      return { success: false, error: 'Savings ledger account not found (account may not be active yet)' };
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
      return { success: false, error: result.error || 'Orchestrator failed to process deposit' };
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
