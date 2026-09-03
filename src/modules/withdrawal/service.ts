// ═══════════════════════════════════════════════════════════════
// External Bank Withdrawal Service
//
// Implements the full withdrawal lifecycle:
//   INITIATED → NAME_ENQUIRY → AUTHORIZED → RESERVED → TRANSFER_SUBMITTED
//   → PENDING → COMPLETED / FAILED / REVERSED
//
// Accounting treatment (TWO-PHASE):
//   Phase 1 (Reservation): D Customer Wallet (2000 child), C Escrow (2004)
//     — Funds move from wallet to escrow (available balance drops)
//   Phase 2a (Success): D Escrow (2004), C Safe Haven Settlement (1000)
//     — Funds leave the platform
//   Phase 2b (Failure/Reversal): D Escrow (2004), C Customer Wallet (2000 child)
//     — Funds returned to wallet
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { getBankingProvider } from '@/modules/integrations';
import { initiate, reverse } from '@/modules/orchestrator';
import {
  candidateKeysFor,
  deriveIdempotencyKey,
  deriveReference,
} from '@/lib/financial-idempotency';
import { reserveWalletHold, releaseWalletHold } from '@/modules/wallet/holds';
import type {
  NameEnquiryRequest,
  NameEnquiryResult,
  InitiateWithdrawalRequest,
  WithdrawalResult,
  ReconciliationResult,
} from './types';
import { validateWithdrawal } from './limits';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Step 1: Name Enquiry — verify beneficiary account before transfer.
 * The customer provides bank + account number. We call Safe Haven's name enquiry
 * to get the verified account name. The transfer MUST use this session ID.
 */
export async function performNameEnquiry(req: NameEnquiryRequest): Promise<NameEnquiryResult> {
  const provider = getBankingProvider();
  const result = await provider.nameEnquiry({
    accountNumber: req.accountNumber,
    bankCode: req.bankCode,
  });

  if (!result.accountName || result.accountName.trim() === '') {
    throw new Error('Name enquiry failed — could not verify account name. Please check the account number and bank.');
  }

  return result;
}

/**
 * Step 2: Initiate Withdrawal — the full flow.
 *
 * 1. Validate (tier, limits, balance, risk)
 * 2. Create withdrawal_request record
 * 3. Reserve funds: D Wallet, C Escrow (through Orchestrator)
 * 4. Submit transfer to Safe Haven
 * 5. Update status based on Safe Haven response
 * 6. On success: settle (D Escrow, C Safe Haven Settlement)
 * 7. On failure: reverse reservation (funds returned to wallet)
 */
export async function initiateWithdrawal(
  req: InitiateWithdrawalRequest & {
    customer_id: string;
    auth_user_id: string;
    ip_address?: string;
    device_id?: string;
  }
): Promise<WithdrawalResult> {
  const supabase = getServiceClient();
  let activeHoldKey: string | null = null;

  try {
    // ── 1. VALIDATE ──────────────────────────────────────────────
    const validation = await validateWithdrawal(req.customer_id, req.wallet_id, req.amount);

    if (!validation.valid) {
      return {
        id: '',
        status: 'failed',
        payment_reference: '',
        amount: req.amount,
        fee: 0,
        message: validation.errors.join('; '),
      };
    }

    // ── 2. IDEMPOTENCY (deterministic, Gate 4 P0 #1) ─────────────
    // Server-derived key: same parameters within the dedup window (or the
    // same client_reference, forever) produce the same key, so retries
    // collapse instead of executing a second withdrawal.
    const idemParams = {
      customer_id: req.customer_id,
      wallet_id: req.wallet_id,
      amount: req.amount,
      destination: req.beneficiary_account_number,
    };
    const idempotencyKey = deriveIdempotencyKey('withdrawal', idemParams);
    const paymentReference = deriveReference('WDL', idempotencyKey);

    // Check for existing withdrawal by deterministic key candidates
    // (current + previous time bucket, to catch boundary-crossing retries)
    const { data: existing } = await supabase
      .from('withdrawal_requests')
      .select('id, status, payment_reference')
      .in('idempotency_key', candidateKeysFor('withdrawal', idemParams))
      .neq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id,
        status: existing.status as WithdrawalResult['status'],
        payment_reference: existing.payment_reference,
        amount: req.amount,
        fee: 0,
        message: existing.status === 'completed'
          ? 'This withdrawal was already completed.'
          : 'A withdrawal with these parameters is already in progress',
      };
    }

    // ── 2b. CONCURRENCY GUARD (Gate 4 P0 #3) ─────────────────────
    // Atomic DB-level hold: concurrent requests cannot both pass the room
    // check, regardless of stale app-side balance reads. Released after the
    // FTO reservation posts (funds then escrowed), or on failure paths.
    const hold = await reserveWalletHold(req.wallet_id, `hold:${idempotencyKey}`, req.amount);
    if (hold.status === 'duplicate') {
      return {
        id: '',
        status: 'failed',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: 'A withdrawal with these parameters is already in progress',
      };
    }
    if (hold.status === 'insufficient') {
      return {
        id: '',
        status: 'failed',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: `Insufficient balance. Your wallet has ₦${Number(hold.available_balance).toLocaleString()}`,
      };
    }
    if (hold.status === 'error') {
      return {
        id: '',
        status: 'failed',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: 'We could not complete this withdrawal right now. Please try again later.',
      };
    }
    activeHoldKey = `hold:${idempotencyKey}`;

    // ── 3. CREATE WITHDRAWAL REQUEST ─────────────────────────────
    const { data: withdrawal, error: wError } = await supabase
      .from('withdrawal_requests')
      .insert({
        customer_id: req.customer_id,
        wallet_id: req.wallet_id,
        beneficiary_bank_code: req.beneficiary_bank_code,
        beneficiary_bank_name: '', // Will be updated from name enquiry
        beneficiary_account_number: req.beneficiary_account_number,
        beneficiary_account_name: req.beneficiary_account_name,
        name_enquiry_session_id: req.name_enquiry_session_id,
        name_enquiry_completed_at: new Date().toISOString(),
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        narration: req.narration || `Withdrawal to ${req.beneficiary_account_name}`,
        status: 'authorized',
        initiated_by_ip: req.ip_address || null,
        initiated_by_device_id: req.device_id || null,
        idempotency_key: idempotencyKey,
        metadata: {
          tier: validation.tier,
          limits: validation.limits,
          available_balance: validation.availableBalance,
        },
      })
      .select('id')
      .single();

    if (wError || !withdrawal) {
      if (activeHoldKey) { await releaseWalletHold(activeHoldKey); activeHoldKey = null; }
      throw new Error(`Failed to create withdrawal request: ${wError?.message}`);
    }

    const withdrawalId = withdrawal.id;

    // ── 4. RESERVE FUNDS: D Wallet, C Escrow ──────────────────────
    // Use the Orchestrator with the new wallet_withdrawal_reservation type
    const reservationResult = await initiate({
      transaction_type: 'wallet_withdrawal_reservation' as any,
      source_module: 'wallet',
      source_reference: withdrawalId,
      amount: req.amount,
      currency: 'NGN',
      description: `Withdrawal reservation: ${paymentReference} to ${req.beneficiary_account_name}`,
      idempotency_key: `reservation:${idempotencyKey}`,
      wallet_id: req.wallet_id,
      metadata: {
        withdrawal_id: withdrawalId,
        payment_reference: paymentReference,
        beneficiary: req.beneficiary_account_name,
      },
    });

    if (reservationResult.status === 'failed') {
      if (activeHoldKey) { await releaseWalletHold(activeHoldKey); activeHoldKey = null; }
      // Update withdrawal status to failed
      await supabase.from('withdrawal_requests').update({
        status: 'failed',
        failure_reason: reservationResult.error || 'Reservation failed',
        failed_at: new Date().toISOString(),
      }).eq('id', withdrawalId);

      return {
        id: withdrawalId,
        status: 'failed',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: reservationResult.error || 'Failed to reserve funds',
      };
    }

    // Update withdrawal status to reserved
    await supabase.from('withdrawal_requests').update({
      status: 'reserved',
      financial_transaction_id: reservationResult.id,
    }).eq('id', withdrawalId);

    // Reservation posted — funds are now escrowed via the confirmed debit in
    // the read model. Release the hold so reserved_balance does not double-count.
    if (activeHoldKey) { await releaseWalletHold(activeHoldKey); activeHoldKey = null; }

    // ── 5. SUBMIT TRANSFER TO SAFE HAVEN ─────────────────────────
    // Get the customer's Safe Haven account number (the debit account)
    const { data: safeHavenAccount } = await supabase
      .from('safe_haven_accounts')
      .select('account_number')
      .eq('customer_id', req.customer_id)
      .maybeSingle();

    if (!safeHavenAccount?.account_number) {
      // No Safe Haven account — reverse the reservation and fail
      await reverseReservation(reservationResult.id, req.wallet_id, 'No Safe Haven account found');

      await supabase.from('withdrawal_requests').update({
        status: 'failed',
        failure_reason: 'No Safe Haven DVA account. Please complete verification first.',
        failed_at: new Date().toISOString(),
      }).eq('id', withdrawalId);

      return {
        id: withdrawalId,
        status: 'failed',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: 'No Safe Haven account. Please complete identity verification first.',
      };
    }

    const provider = getBankingProvider();

    let transferResponse;
    try {
      transferResponse = await provider.transfer({
        nameEnquiryReference: req.name_enquiry_session_id,
        debitAccountNumber: safeHavenAccount.account_number,
        beneficiaryBankCode: req.beneficiary_bank_code,
        beneficiaryAccountNumber: req.beneficiary_account_number,
        amount: req.amount,
        narration: req.narration || `Withdrawal ${paymentReference}`,
        paymentReference: paymentReference,
        saveBeneficiary: false,
      });
    } catch (transferError) {
      // Transfer API call failed — reverse the reservation
      await reverseReservation(reservationResult.id, req.wallet_id, `Transfer API error: ${transferError instanceof Error ? transferError.message : String(transferError)}`);

      await supabase.from('withdrawal_requests').update({
        status: 'failed',
        failure_reason: transferError instanceof Error ? transferError.message : 'Transfer failed',
        failure_code: 'TRANSFER_API_ERROR',
        failed_at: new Date().toISOString(),
      }).eq('id', withdrawalId);

      return {
        id: withdrawalId,
        status: 'failed',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: `Transfer failed: ${transferError instanceof Error ? transferError.message : 'Unknown error'}`,
      };
    }

    // ── 6. PROCESS SAFE HAVEN RESPONSE ──────────────────────────
    await supabase.from('withdrawal_requests').update({
      status: 'transfer_submitted',
      safe_haven_reference: transferResponse.reference,
      transfer_submitted_at: new Date().toISOString(),
    }).eq('id', withdrawalId);

    if (transferResponse.status === 'success') {
      // ── 7a. SUCCESS: Settle the withdrawal ────────────────────
      // D Escrow (2004), C Safe Haven Settlement (1000)
      await settleWithdrawal(withdrawalId, req.wallet_id, req.amount, paymentReference, transferResponse.reference);

      await supabase.from('withdrawal_requests').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', withdrawalId);

      return {
        id: withdrawalId,
        status: 'completed',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: 'Withdrawal completed successfully',
      };
    }

    if (transferResponse.status === 'pending') {
      // ── 7b. PENDING: Wait for webhook or status check ──────────
      await supabase.from('withdrawal_requests').update({
        status: 'pending',
      }).eq('id', withdrawalId);

      return {
        id: withdrawalId,
        status: 'pending',
        payment_reference: paymentReference,
        amount: req.amount,
        fee: 0,
        message: 'Transfer submitted — awaiting settlement confirmation',
      };
    }

    // ── 7c. FAILED: Reverse the reservation ─────────────────────
    await reverseReservation(reservationResult.id, req.wallet_id, `Transfer failed: ${transferResponse.message || 'Unknown'}`);

    await supabase.from('withdrawal_requests').update({
      status: 'failed',
      failure_reason: transferResponse.message || 'Transfer failed at Safe Haven',
      failure_code: 'TRANSFER_REJECTED',
      failed_at: new Date().toISOString(),
    }).eq('id', withdrawalId);

    return {
      id: withdrawalId,
      status: 'failed',
      payment_reference: paymentReference,
      amount: req.amount,
      fee: 0,
      message: transferResponse.message || 'Transfer failed',
    };

  } catch (error) {
    if (activeHoldKey) {
      await releaseWalletHold(activeHoldKey).catch(() => {});
      activeHoldKey = null;
    }
    console.error('[Withdrawal] Initiate failed:', error);
    return {
      id: '',
      status: 'failed',
      payment_reference: '',
      amount: req.amount,
      fee: 0,
      message: error instanceof Error ? error.message : 'Internal error',
    };
  }
}

/**
 * Settle a successful withdrawal:
 * D Escrow (2004), C Safe Haven Settlement (1000)
 */
async function settleWithdrawal(
  withdrawalId: string,
  walletId: string,
  amount: number,
  paymentReference: string,
  safeHavenReference: string
): Promise<void> {
  const settlementResult = await initiate({
    transaction_type: 'wallet_withdrawal_settlement' as any,
    source_module: 'wallet',
    source_reference: withdrawalId,
    amount,
    currency: 'NGN',
    description: `Withdrawal settlement: ${paymentReference}`,
    idempotency_key: `settlement:${withdrawalId}`,
    wallet_id: walletId,
    metadata: {
      withdrawal_id: withdrawalId,
      payment_reference: paymentReference,
      safe_haven_reference: safeHavenReference,
    },
  });

  if (settlementResult.status === 'failed') {
    // Settlement failed — this is a serious problem. The transfer went through
    // but the ledger entry wasn't posted. Flag for reconciliation.
    const supabase = getServiceClient();
    await supabase.from('withdrawal_requests').update({
      status: 'requires_reconciliation',
      failure_reason: `Settlement posting failed: ${settlementResult.error}`,
      failure_code: 'SETTLEMENT_POSTING_FAILED',
    }).eq('id', withdrawalId);

    // Also create a reconciliation flag
    await supabase.from('reconciliation_flags').insert({
      wallet_id: walletId,
      flag_type: 'settlement_mismatch',
      description: `Withdrawal ${paymentReference} transfer succeeded but ledger settlement failed`,
      severity: 'high',
      metadata: {
        withdrawal_id: withdrawalId,
        safe_haven_reference: safeHavenReference,
        settlement_error: settlementResult.error,
      },
    });

    throw new Error('Settlement posting failed — flagged for reconciliation');
  }
}

/**
 * Reverse a reservation — return funds to the customer's wallet.
 */
async function reverseReservation(
  originalFtId: string,
  walletId: string,
  reason: string
): Promise<void> {
  try {
    const result = await reverse({
      original_transaction_id: originalFtId,
      reason,
      idempotency_key: `reversal:${originalFtId}`,
    });

    if (result.status === 'failed') {
      console.error('[Withdrawal] Reversal failed:', result.error);
      // This is critical — funds are stuck in escrow
      const supabase = getServiceClient();
      await supabase.from('reconciliation_flags').insert({
        wallet_id: walletId,
        flag_type: 'reversal_failed',
        description: `Reversal failed for FT ${originalFtId}: ${reason}. Reversal error: ${result.error}`,
        severity: 'critical',
        metadata: { original_ft_id: originalFtId, reason, reversal_error: result.error },
      });
    }
  } catch (error) {
    console.error('[Withdrawal] Reversal exception:', error);
  }
}

/**
 * Reconcile a pending withdrawal by checking Safe Haven's transfer status.
 * Called by webhook handler or a cron job.
 */
export async function reconcileWithdrawal(withdrawalId: string): Promise<ReconciliationResult> {
  const supabase = getServiceClient();

  const { data: withdrawal } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', withdrawalId)
    .maybeSingle();

  if (!withdrawal) {
    return { status: 'requires_reconciliation', message: 'Withdrawal not found' };
  }

  if (!['pending', 'transfer_submitted', 'requires_reconciliation'].includes(withdrawal.status)) {
    return {
      status: withdrawal.status as ReconciliationResult['status'],
      safe_haven_reference: withdrawal.safe_haven_reference,
      message: `Withdrawal already ${withdrawal.status}`,
    };
  }

  const provider = getBankingProvider();

  try {
    const transferStatus = await provider.getTransferStatus(withdrawal.payment_reference);

    if (transferStatus.status === 'success') {
      // Transfer confirmed — settle
      await settleWithdrawal(
        withdrawalId,
        withdrawal.wallet_id,
        Number(withdrawal.amount),
        withdrawal.payment_reference,
        transferStatus.reference || withdrawal.safe_haven_reference
      );

      await supabase.from('withdrawal_requests').update({
        status: 'completed',
        safe_haven_reference: transferStatus.reference || withdrawal.safe_haven_reference,
        completed_at: new Date().toISOString(),
      }).eq('id', withdrawalId);

      return {
        status: 'completed',
        safe_haven_reference: transferStatus.reference,
        message: 'Withdrawal completed via reconciliation',
      };
    }

    if (transferStatus.status === 'failed') {
      // Transfer failed — reverse the reservation
      const { data: ft } = await supabase
        .from('withdrawal_requests')
        .select('financial_transaction_id')
        .eq('id', withdrawalId)
        .maybeSingle();

      if (ft?.financial_transaction_id) {
        await reverseReservation(ft.financial_transaction_id, withdrawal.wallet_id, `Transfer failed: ${transferStatus.message}`);
      }

      await supabase.from('withdrawal_requests').update({
        status: 'failed',
        failure_reason: transferStatus.message || 'Transfer failed (reconciled)',
        failure_code: 'TRANSFER_FAILED_RECONCILED',
        failed_at: new Date().toISOString(),
      }).eq('id', withdrawalId);

      return {
        status: 'failed',
        safe_haven_reference: transferStatus.reference,
        message: 'Withdrawal failed via reconciliation — funds returned',
      };
    }

    // Still pending
    return {
      status: 'pending',
      safe_haven_reference: transferStatus.reference,
      message: 'Transfer still pending at Safe Haven',
    };

  } catch (error) {
    // Reconciliation check failed — flag for manual review
    await supabase.from('withdrawal_requests').update({
      status: 'requires_reconciliation',
    }).eq('id', withdrawalId);

    return {
      status: 'requires_reconciliation',
      message: `Reconciliation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get a withdrawal by ID (for status checking).
 */
export async function getWithdrawal(withdrawalId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', withdrawalId)
    .maybeSingle();
  return data;
}

/**
 * List customer's withdrawals.
 */
export async function listWithdrawals(customerId: string, limit = 20, offset = 0) {
  const supabase = getServiceClient();
  const { data, count } = await supabase
    .from('withdrawal_requests')
    .select('*', { count: 'exact' })
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return { withdrawals: data || [], total: count || 0 };
}
