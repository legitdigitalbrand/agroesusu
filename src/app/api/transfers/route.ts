import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBankingProvider } from '@/modules/integrations';
import { initiate, reverse } from '@/modules/orchestrator';
import { refreshWalletBalanceCache } from '@/modules/ledger';
import { reserveWalletHold, releaseWalletHold } from '@/modules/wallet/holds';
import {
  candidateKeysFor,
  deriveIdempotencyKey,
  deriveReference,
  findExistingTransaction,
  findExistingTransfer,
} from '@/lib/financial-idempotency';

// POST /api/transfers — initiate a bank transfer from wallet
//
// TWO-PHASE (Gate 4 P0 #2 — mirrors withdrawal/service.ts):
//   Phase 1 (Reservation): wallet hold placed (concurrency guard, P0 #3),
//     then D Customer Wallet, C Escrow (2004) via FTO. Available drops.
//   Phase 2a (Success):  D Escrow (2004), C Safe Haven Settlement (1000)
//   Phase 2b (Pending):  funds stay reserved; webhook/recon confirms later
//   Phase 2c (Failure):  reservation reversed — funds returned to wallet
//
// IDEMPOTENCY (Gate 4 P0 #1): deterministic server-derived keys. A retried
// request (double-click, network retry) hits the same key and returns the
// existing transfer instead of executing a second one.
//
// Body: {
//   nameEnquiryReference: string,
//   beneficiaryBankCode: string,
//   beneficiaryBankName: string,
//   beneficiaryAccountNumber: string,
//   beneficiaryAccountName: string,
//   amount: number,
//   narration?: string,
//   clientReference?: string  // optional client-supplied idempotency reference
// }
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/transfers", RATE_LIMITS.TRANSFER);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      nameEnquiryReference,
      beneficiaryBankCode,
      beneficiaryBankName,
      beneficiaryAccountNumber,
      beneficiaryAccountName,
      amount,
      narration,
      clientReference,
    } = body;

    // Validate required fields
    if (!nameEnquiryReference || !beneficiaryBankCode || !beneficiaryAccountNumber ||
        !beneficiaryAccountName || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields for transfer' },
        { status: 400 }
      );
    }

    const transferAmount = Number(amount);

    // Get customer and wallet
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, account_number, cached_available_balance, cached_balance, reserved_balance')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!wallet) {
      return NextResponse.json({ error: 'No active wallet found' }, { status: 400 });
    }

    // ── IDEMPOTENCY: deterministic key + existing-transaction check ────────
    const idemParams = {
      customer_id: customer.id,
      wallet_id: wallet.id,
      amount: transferAmount,
      destination: String(beneficiaryAccountNumber),
      client_reference: clientReference || undefined,
    };
    const idempotencyKey = deriveIdempotencyKey('bank_transfer', idemParams);

    const [existingFt, existingTransfer] = await Promise.all([
      findExistingTransaction(candidateKeysFor('bank_transfer', idemParams)),
      findExistingTransfer([
        deriveReference('TRF', idempotencyKey),
      ]),
    ]);

    if (existingFt || existingTransfer) {
      const ref = existingTransfer?.reference || existingFt?.transaction_reference || '';
      const status = existingTransfer?.status ||
        (existingFt?.status === 'completed' ? 'success' : 'pending');
      const inFlight = ['initiated', 'validated', 'posting', 'posted'].includes(existingFt?.status || '');
      return NextResponse.json({
        reference: ref,
        status,
        duplicate: true,
        message: inFlight
          ? 'This transfer is already being processed. Please wait for it to complete.'
          : 'This transfer was already completed.',
      });
    }

    // Fast-path UX check (authoritative check is the DB-level hold below)
    const available = Number(wallet.cached_balance) - Number(wallet.reserved_balance);
    if (available < transferAmount) {
      return NextResponse.json(
        { error: `Insufficient balance. Your wallet has ₦${available.toLocaleString()}` },
        { status: 400 }
      );
    }

    const paymentReference = deriveReference('TRF', idempotencyKey);
    const serviceClient = createServiceClient();

    // ── CONCURRENCY GUARD: atomic wallet hold (P0 #3) ──────────────────────
    // The room check runs inside the DB against the LIVE row, so concurrent
    // requests cannot both pass. Hold is released in the finally block after
    // the FTO reservation posts (funds then escrowed via confirmed debit).
    const hold = await reserveWalletHold(wallet.id, `hold:${idempotencyKey}`, transferAmount);
    if (hold.status === 'duplicate') {
      return NextResponse.json({
        reference: paymentReference,
        status: 'pending',
        duplicate: true,
        message: 'This transfer is already being processed. Please wait for it to complete.',
      });
    }
    if (hold.status === 'insufficient') {
      return NextResponse.json(
        { error: `Insufficient balance. Your wallet has ₦${Number(hold.available_balance).toLocaleString()}` },
        { status: 400 }
      );
    }
    if (hold.status === 'error') {
      return NextResponse.json(
        { error: 'We could not complete this transaction right now. Please try again later.' },
        { status: 503 }
      );
    }

    // Record the transfer (deterministic reference; UNIQUE(reference) makes a
    // concurrent duplicate insert fail at the DB level)
    const { data: transferRow, error: transferInsertError } = await serviceClient
      .from('transfers')
      .insert({
        customer_id: customer.id,
        wallet_id: wallet.id,
        reference: paymentReference,
        debit_account_number: wallet.account_number,
        beneficiary_bank_code: beneficiaryBankCode,
        beneficiary_bank_name: beneficiaryBankName,
        beneficiary_account_number: beneficiaryAccountNumber,
        beneficiary_account_name: beneficiaryAccountName,
        amount: transferAmount,
        narration: narration || `Transfer to ${beneficiaryAccountName}`,
        payment_reference: paymentReference,
        status: 'initiated',
        name_enquiry_session_id: nameEnquiryReference,
        metadata: { idempotency_key: idempotencyKey },
      })
      .select('id')
      .single();

    if (transferInsertError || !transferRow) {
      await releaseWalletHold(`hold:${idempotencyKey}`);
      // Unique violation = concurrent duplicate of the same logical request
      if (transferInsertError?.code === '23505') {
        return NextResponse.json({
          reference: paymentReference,
          status: 'pending',
          duplicate: true,
          message: 'This transfer is already being processed. Please wait for it to complete.',
        });
      }
      console.error('[API:transfers] Insert failed:', transferInsertError);
      return NextResponse.json({ error: 'Transfer could not be initiated' }, { status: 500 });
    }

    const transferId = transferRow.id;

    try {
      // ── PHASE 1: RESERVE — D Customer Wallet, C Escrow (2004) ───────────
      const reservationResult = await initiate({
        transaction_type: 'wallet_withdrawal_reservation' as never,
        source_module: 'wallet',
        source_reference: transferId,
        amount: transferAmount,
        currency: 'NGN',
        description: `Transfer reservation: ${paymentReference} to ${beneficiaryAccountName}`,
        idempotency_key: `bank_transfer_reservation:${idempotencyKey}`,
        wallet_id: wallet.id,
        metadata: {
          transfer_id: transferId,
          payment_reference: paymentReference,
          beneficiary: beneficiaryAccountName,
        },
      });

      if (reservationResult.status === 'failed') {
        await serviceClient.from('transfers').update({
          status: 'failed',
          provider_response: { error: reservationResult.error || 'Reservation failed' },
        }).eq('id', transferId);

        return NextResponse.json(
          { error: 'We could not complete this transaction right now. Please try again later.' },
          { status: 400 }
        );
      }

      // Reservation posted — funds are now escrowed in the ledger/read model.
      // Release the hold so reserved_balance does not double-count.
      await releaseWalletHold(`hold:${idempotencyKey}`);

      await serviceClient.from('transfers').update({
        status: 'reserved',
        metadata: { idempotency_key: idempotencyKey, reservation_ft_id: reservationResult.id },
      }).eq('id', transferId);

      // ── SUBMIT TRANSFER TO SAFE HAVEN ────────────────────────────────────
      const provider = getBankingProvider();

      let transferResult;
      try {
        transferResult = await provider.transfer({
          nameEnquiryReference,
          debitAccountNumber: wallet.account_number,
          beneficiaryBankCode,
          beneficiaryAccountNumber,
          amount: transferAmount,
          narration: narration || `Transfer ${paymentReference}`,
          paymentReference,
          saveBeneficiary: false,
        });
      } catch (transferError) {
        // Provider API call failed — reverse the reservation (funds back to wallet)
        await reverseReservation(reservationResult.id, wallet.id);
        await serviceClient.from('transfers').update({
          status: 'failed',
          provider_response: {
            error: transferError instanceof Error ? transferError.message : String(transferError),
          },
        }).eq('id', transferId);

        return NextResponse.json(
          { error: 'We could not complete this transaction right now. Please try again later.' },
          { status: 502 }
        );
      }

      // Persist the provider response
      await serviceClient.from('transfers').update({
        provider_response: transferResult,
        status: transferResult.status === 'success' ? 'settling' : transferResult.status,
      }).eq('id', transferId);

      // ── PHASE 2: SETTLE or hold reserved ─────────────────────────────────
      if (transferResult.status === 'success') {
        // D Escrow (2004), C Safe Haven Settlement (1000)
        const settlementResult = await initiate({
          transaction_type: 'wallet_withdrawal_settlement' as never,
          source_module: 'wallet',
          source_reference: transferId,
          amount: transferAmount,
          currency: 'NGN',
          description: `Transfer settlement: ${paymentReference}`,
          idempotency_key: `bank_transfer_settlement:${idempotencyKey}`,
          wallet_id: wallet.id,
          metadata: {
            transfer_id: transferId,
            payment_reference: paymentReference,
            safe_haven_reference: transferResult.reference,
          },
        });

        if (settlementResult.status === 'failed') {
          // Funds left Safe Haven but settlement posting failed — flag for
          // reconciliation; do NOT mark success falsely
          console.error('[API:transfers] Settlement posting failed:', settlementResult.error);
          await serviceClient.from('transfers').update({
            status: 'pending_settlement',
            metadata: { idempotency_key: idempotencyKey, settlement_error: settlementResult.error },
          }).eq('id', transferId);

          return NextResponse.json({
            reference: paymentReference,
            status: 'pending',
            message: 'Transfer submitted. It will be confirmed shortly.',
          });
        }

        await serviceClient.from('transfers').update({
          status: 'success',
        }).eq('id', transferId);

        return NextResponse.json({
          reference: paymentReference,
          status: 'success',
          message: 'Transfer completed successfully',
        });
      }

      if (transferResult.status === 'pending') {
        // Funds remain reserved in escrow. Webhook / reconciliation cron will
        // confirm the provider outcome and settle or reverse.
        await serviceClient.from('transfers').update({
          status: 'pending',
        }).eq('id', transferId);

        return NextResponse.json({
          reference: paymentReference,
          status: 'pending',
          message: 'Transfer is being processed',
        });
      }

      // Provider reported failure — reverse the reservation, funds returned
      await reverseReservation(reservationResult.id, wallet.id);
      await serviceClient.from('transfers').update({
        status: 'failed',
      }).eq('id', transferId);

      return NextResponse.json(
        { reference: paymentReference, status: 'failed', message: 'Transfer failed' },
        { status: 400 }
      );

    } finally {
      // Safety net: if we exit before the post-reservation release happened
      // (crash-safe in-process), release the hold now. releaseWalletHold is
      // idempotent (no-op when already released).
      await releaseWalletHold(`hold:${idempotencyKey}`);
      await refreshWalletBalanceCache(wallet.id).catch(() => {});
    }

  } catch (error) {
    console.error('[API:transfers] Error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    const isNetworkError = errMsg.includes('ERR_NAME_NOT_RESOLVED') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('ECONNREFUSED');
    if (isNetworkError) {
      return NextResponse.json(
        { error: 'Unable to connect to banking service. Check your connection and try again.', code: 'network_error' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'We could not complete this transaction right now. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * Reverse a reservation: funds return from escrow to the wallet.
 * Mirrors withdrawal/service.ts reverseReservation.
 */
async function reverseReservation(reservationFtId: string, walletId: string, reason?: string) {
  try {
    await reverse({
      original_transaction_id: reservationFtId,
      reason: reason || 'Transfer failed — reservation reversed',
      idempotency_key: `reversal:${reservationFtId}`,
    });
    await refreshWalletBalanceCache(walletId).catch(() => {});
  } catch (revErr) {
    console.error('[API:transfers] Reservation reversal failed:', revErr);
  }
}

// GET /api/transfers — list user's transfers
export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ transfers: [] });
    }

    const { data: transfers } = await supabase
      .from('transfers')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ transfers: transfers || [] });

  } catch (error) {
    console.error('[API:transfers GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
