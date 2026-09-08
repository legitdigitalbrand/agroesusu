// ============================================================================
// Savings Withdrawal Flow
// 
// Validates withdrawal against product rules (lock periods, penalties, min
// balance) BEFORE calling the Orchestrator. If validation fails, the
// request is rejected — it never reaches the Ledger.
// 
// The Orchestrator stays product-agnostic — it doesn't know about lock
// periods or penalties. All product rule enforcement happens here.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { initiate } from '@/modules/orchestrator';
import { getAccount, getSavingsBalance } from './accounts';
import type { WithdrawalRequest, WithdrawalValidationResult } from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Validate a withdrawal against product rules.
 * 
 * Checks:
 * 1. Account is active or matured
 * 2. Withdrawals are allowed for this product
 * 3. Sufficient balance
 * 4. Lock period has passed (if applicable)
 * 5. Early withdrawal penalty (if applicable)
 * 6. Minimum balance maintained after withdrawal
 * 
 * Returns validation result with penalty amount if applicable.
 * If allowed === false, the withdrawal must NOT proceed to the Orchestrator.
 */
export async function validateWithdrawal(request: WithdrawalRequest): Promise<WithdrawalValidationResult> {
  const errors: string[] = [];
  let penaltyAmount = 0;
  let netAmount = request.amount;

  // 1. Fetch the account
  const account = await getAccount(request.savings_account_id);
  if (!account) {
    return { allowed: false, errors: ['Savings account not found'] };
  }

  // 2. Check account status
  if (account.status !== 'active' && account.status !== 'matured') {
    errors.push(`Cannot withdraw from a ${account.status} account`);
    return { allowed: false, errors };
  }

  // 3. Get terms from snapshot
  const terms = account.product_terms_snapshot as {
    withdrawal_allowed: boolean;
    lock_period_days: number;
    early_withdrawal_allowed: boolean;
    early_withdrawal_penalty_rate: number;
    minimum_balance: number;
  };

  // 4. Check if withdrawals are allowed at all
  if (!terms.withdrawal_allowed) {
    errors.push('Withdrawals are not allowed for this savings product');
    return { allowed: false, errors };
  }

  // 5. Check lock period (for active accounts — matured accounts can withdraw freely)
  let isLocked = false;
  if (account.status === 'active' && terms.lock_period_days > 0) {
    const openedAt = account.opened_at ? new Date(account.opened_at) : null;
    if (openedAt) {
      const lockEnd = new Date(openedAt);
      lockEnd.setDate(lockEnd.getDate() + terms.lock_period_days);
      const now = new Date();

      if (now < lockEnd) {
        isLocked = true;

        if (request.emergency) {
          // ── EMERGENCY EARLY EXIT ──────────────────────────────
          // Bypasses early_withdrawal_allowed entirely. The customer
          // receives 100% of principal and forfeits all accrued interest.
          // No penalty fee is charged.
        } else if (!terms.early_withdrawal_allowed) {
          errors.push(`Withdrawal locked until ${lockEnd.toDateString()}. Early withdrawal is not allowed for this product.`);
          return { allowed: false, errors };
        } else {
          // Early withdrawal allowed but with penalty
          const penaltyRate = terms.early_withdrawal_penalty_rate || 0;
          if (penaltyRate > 0) {
            penaltyAmount = (request.amount * penaltyRate) / 100;
            netAmount = request.amount - penaltyAmount;
          }
        }
      }
    }
  }

  // 6. Check sufficient balance
  const balance = await getSavingsBalance(request.savings_account_id);
  if (request.amount > balance) {
    errors.push(`Insufficient savings balance. Available: ₦${balance}, Requested: ₦${request.amount}`);
    return { allowed: false, errors };
  }

  // ── EMERGENCY EXIT: full-balance close, principal only ──────────────
  if (request.emergency) {
    if (!isLocked) {
      errors.push('Emergency withdrawal is only available for locked accounts. Use a regular withdrawal instead.');
      return { allowed: false, errors };
    }
    if (account.status !== 'active') {
      errors.push(`Cannot emergency-withdraw from a ${account.status} account.`);
      return { allowed: false, errors };
    }
    // Emergency exit closes the deposit: the full balance must be withdrawn.
    if (request.amount < balance) {
      errors.push('Emergency withdrawal closes the deposit — withdraw the full balance.');
      return { allowed: false, errors };
    }

    // Principal only: interest already credited to the pot is forfeited.
    // (Fixed deposits accrue at maturity, so this is normally 0 — but any
    // accrued interest stays in the product account and is never paid out.)
    const interestEarned = Number(account.total_interest_earned || 0);
    const payout = Math.max(0, Math.round((balance - interestEarned) * 100) / 100);

    return {
      allowed: true,
      errors: [],
      penalty_amount: 0,
      net_amount: payout,
      payout_amount: payout,
      interest_forfeited: Math.round((balance - payout) * 100) / 100,
    };
  }

  // 7. Check minimum balance after withdrawal
  const minBalance = terms.minimum_balance || 0;
  const remainingBalance = balance - request.amount;
  if (minBalance > 0 && remainingBalance < minBalance && remainingBalance > 0) {
    errors.push(`Minimum balance of ₦${minBalance} must be maintained. You can withdraw up to ₦${balance - minBalance}.`);
    return { allowed: false, errors };
  }

  if (errors.length > 0) {
    return { allowed: false, errors };
  }

  return {
    allowed: true,
    errors: [],
    penalty_amount: penaltyAmount > 0 ? penaltyAmount : undefined,
    net_amount: netAmount,
  };
}

/**
 * Process a savings withdrawal.
 * 
 * Flow:
 * 1. Validate the withdrawal against product rules
 * 2. If validation fails, return the errors — do NOT call the Orchestrator
 * 3. If penalty applies, post the penalty as a separate transaction (future)
 * 4. Call Orchestrator.initiate() with savings_withdrawal type
 * 5. The Orchestrator posts: Debit Savings Account, Credit Wallet
 * 6. If withdrawing full balance, mark account as 'withdrawn'
 */
export async function withdraw(request: WithdrawalRequest): Promise<{
  success: boolean;
  transaction_reference?: string;
  penalty_amount?: number;
  net_amount?: number;
  interest_forfeited?: number;
  error?: string;
}> {
  const supabase = getServiceClient();

  try {
    // 1. Validate the withdrawal
    const validation = await validateWithdrawal(request);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.errors.join('; '),
      };
    }

    // 2. Fetch the account (need account_number for description)
    const account = await getAccount(request.savings_account_id);
    if (!account) return { success: false, error: 'Account not found' };

    // 3. Look up the savings account's ledger account ID
    const { data: ledgerAccountId, error: ledgerError } = await supabase.rpc(
      'get_savings_account_id',
      { p_savings_account_id: request.savings_account_id }
    );

    if (ledgerError || !ledgerAccountId) {
      return { success: false, error: 'Savings ledger account not found' };
    }

    // 4. Call the Orchestrator with the validated amount.
    // Emergency exits pay out the PRINCIPAL ONLY (validation.payout_amount);
    // forfeited interest stays in the product account and is never paid out.
    // No penalty fee is charged — the customer never loses principal.
    const payoutAmount = request.emergency && validation.payout_amount !== undefined
      ? validation.payout_amount
      : request.amount;

    if (payoutAmount <= 0) {
      return { success: false, error: 'Nothing to withdraw: principal is zero.' };
    }

    const result = await initiate({
      transaction_type: 'savings_withdrawal',
      source_module: 'savings',
      source_reference: request.savings_account_id,
      amount: payoutAmount,
      currency: 'NGN',
      description: request.description
        || (request.emergency
          ? `Emergency early exit from ${account.account_number} (interest forfeited)`
          : `Savings withdrawal from ${account.account_number}`),
      idempotency_key: `savings_withdrawal:${request.savings_account_id}:${Date.now()}`,
      wallet_id: request.wallet_id,
      product_account_id: ledgerAccountId as string,
      metadata: {
        savings_account_id: request.savings_account_id,
        product_id: account.product_id,
        emergency: request.emergency || false,
        penalty_amount: validation.penalty_amount || 0,
        net_amount: validation.net_amount,
        interest_forfeited: validation.interest_forfeited || 0,
      },
    });

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Orchestrator failed to process withdrawal' };
    }

    // 5. Check if this is a full withdrawal (balance will be ~0)
    const remainingBalance = await getSavingsBalance(request.savings_account_id);
    if (request.emergency || remainingBalance <= 1) { // Tolerance of ₦1
      // Mark account as withdrawn. Emergency exits always close the deposit
      // (any forfeited interest residue stays in the product account — it is
      // never credited and accrual skips non-active accounts).
      await supabase
        .from('savings_accounts')
        .update({
          status: 'withdrawn',
          closed_at: new Date().toISOString(),
        })
        .eq('id', request.savings_account_id);
    }

    return {
      success: true,
      transaction_reference: result.transaction_reference,
      penalty_amount: validation.penalty_amount,
      net_amount: validation.net_amount,
      interest_forfeited: validation.interest_forfeited,
    };

  } catch (error) {
    console.error('[Savings:withdraw] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
