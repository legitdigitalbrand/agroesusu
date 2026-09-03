import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { reconcileWithdrawal } from '@/modules/withdrawal';
import { reconcileTransfer } from '@/modules/transfers';
import { processIncomingCredit } from '@/modules/wallet/incoming-credit';
import { verifyWebhookToken } from '@/lib/webhook-security';
import { getSafeHavenAuthService } from '@/modules/integrations/safe-haven/auth';

// ============================================================================
// Safe Haven Webhook Handler — Phase 17 Security Hardening
//
// Receives webhooks from Safe Haven MFB for:
//   - Incoming bank transfer credits (account_credit / transfer_received)
//   - Outbound transfer completion/failure
//   - Identity verification completions
//
// Security (defense in depth):
//   1. SECRET QUERY PARAMETER — Safe Haven does NOT sign webhooks. A secret
//      token is embedded in the webhook URL configured on the Safe Haven
//      dashboard (e.g., .../safe-haven?token=XXX). This is the primary
//      authentication mechanism per Safe Haven's own recommendation.
//   2. API RE-VERIFICATION — For incoming credits, we call Safe Haven's API
//      to verify the transaction actually exists before crediting any wallet.
//   3. Idempotency — external_event_id unique constraint prevents duplicates.
//   4. Append-only audit — all events stored in inbound_events table.
//
// Idempotency: A duplicated webhook must NEVER create duplicated funds.
// ============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Verify the webhook request using a secret query parameter.
 * Safe Haven does not sign webhook payloads — the recommended approach is to
 * include a secret token in the webhook URL configured on the Safe Haven dashboard.
 *
 * The webhook URL registered with Safe Haven should be:
 *   https://agriqcap.vercel.app/api/webhooks/safe-haven?token=SAFE_HAVEN_WEBHOOK_SECRET
 *
 * This function checks that the `token` query parameter matches the env var.
 */
/**
 * Verification outcome (Gate 4 P0 #5):
 *   'verified'     — Safe Haven confirmed the transaction; safe to credit.
 *   'unverified'   — Safe Haven definitively refuted it (not found / failed
 *                    status / mismatch); reject.
 *   'indeterminate'— the verification API itself failed (network, 5xx, auth).
 *                    QUARANTINE: mark the event processing_failed and do NOT
 *                    credit. Approved business decision (webhook quarantine
 *                    policy): a credit is never posted on an unconfirmed
 *                    transaction; the event stays in inbound_events for retry
 *                    (dedup prevents double-processing when retried).
 */
type CreditVerification =
  | 'verified'
  | 'unverified'
  | 'indeterminate';

/**
 * Re-verify an incoming credit by calling Safe Haven's API.
 * This is defense-in-depth: even if someone knows the webhook token, the
 * transaction must actually exist in Safe Haven's system before we credit.
 *
 * We use the payment reference / session ID from the webhook to query
 * Safe Haven's transfer status endpoint and confirm the transaction is real.
 */
async function verifyIncomingCreditWithSafeHaven(
  paymentReference: string,
  accountNumber: string,
  amount: number
): Promise<CreditVerification> {
  try {
    const authService = getSafeHavenAuthService();
    const accessToken = await authService.getAccessToken();
    const ibsClientId = authService.getIbsClientId();
    const apiUrl = process.env.SAFEHAVEN_API_URL || 'https://api.sandbox.safehavenmfb.com';

    // Call Safe Haven's transfer status endpoint to verify the transaction
    const response = await fetch(`${apiUrl}/transfers/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ClientID': ibsClientId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ paymentReference }),
    });

    if (!response.ok) {
      console.error(`[Webhook] Safe Haven verification API returned ${response.status}`);
      // API-level failure (5xx/4xx from the verification service itself):
      // indeterminate — quarantine, never credit on an unconfirmed transaction.
      return 'indeterminate';
    }

    const data = await response.json();
    const txData = (data.data || data) as Record<string, unknown>;

    // Verify the transaction status indicates a successful credit
    const status = (txData.status as string || '').toLowerCase();
    const verifiedAmount = Number(txData.amount || 0);
    const verifiedAccount = (txData.accountNumber as string || txData.creditAccount as string || '');

    // Accept if status is successful and amount matches
    const statusOk = ['success', 'completed', 'successful', 'ok'].includes(status);
    const amountOk = verifiedAmount === amount || verifiedAmount === 0; // Some APIs don't return amount in status
    const accountOk = !verifiedAccount || verifiedAccount === accountNumber;

    if (!statusOk) {
      console.error(`[Webhook] Safe Haven verification: status=${status} (not success)`);
      return 'unverified';
    }
    if (!amountOk) {
      console.error(`[Webhook] Safe Haven verification: amount mismatch (expected=${amount}, got=${verifiedAmount})`);
      return 'unverified';
    }
    if (!accountOk) {
      console.error(`[Webhook] Safe Haven verification: account mismatch (expected=${accountNumber}, got=${verifiedAccount})`);
      return 'unverified';
    }

    console.log(`[Webhook] Safe Haven verification PASSED for ref=${paymentReference}`);
    return 'verified';
  } catch (error) {
    console.error('[Webhook] Safe Haven verification error:', error);
    // QUARANTINE (approved decision): the verification API is unavailable, so
    // the transaction is UNCONFIRMED. Do not credit. The event is marked
    // processing_failed and remains in inbound_events for retry — the
    // (source, external_event_id) uniqueness prevents double-processing.
    console.warn('[Webhook] Verification API unavailable — quarantining event for retry (no credit posted)');
    return 'indeterminate';
  }
}

function mapEventType(shEventType: string): string {
  const map: Record<string, string> = {
    'transfer': 'transfer_received',
    'transfer.success': 'transfer_completed',
    'transfer.failed': 'transfer_failed',
    'credit': 'account_credit',
    'debit': 'account_debit',
    'verification': 'verification_completed',
    'transfer.received': 'transfer_received',
    'account.credit': 'account_credit',
    'account.debit': 'account_debit',
    'virtualaccount.transfer': 'virtual_account_transfer',
  };
  return map[shEventType.toLowerCase()] || 'unknown';
}

function extractExternalEventId(payload: Record<string, unknown>): string | null {
  return (
    (payload._id as string) ||
    (payload.transactionId as string) ||
    (payload.eventId as string) ||
    (payload.reference as string) ||
    (payload.paymentReference as string) ||
    null
  );
}

function extractPaymentReference(payload: Record<string, unknown>): string | null {
  if (payload.paymentReference) return payload.paymentReference as string;
  if (payload.reference) return payload.reference as string;
  if (payload.data && typeof payload.data === 'object') {
    const dataObj = payload.data as Record<string, unknown>;
    if (dataObj.paymentReference) return dataObj.paymentReference as string;
  }
  return null;
}

function extractIncomingCredit(payload: Record<string, unknown>): {
  safe_haven_reference: string;
  account_number: string;
  account_name?: string;
  amount: number;
  sender_name?: string;
  sender_account_number?: string;
  sender_bank_name?: string;
  narration?: string;
  payment_reference?: string;
} | null {
  const data = (payload.data || payload) as Record<string, unknown>;

  const ref =
    (data.transactionReference as string) ||
    (data.reference as string) ||
    (data._id as string) ||
    (payload._id as string) ||
    '';

  const accountNumber =
    (data.accountNumber as string) ||
    (data.creditAccount as string) ||
    (data.destinationAccountNumber as string) ||
    (data.account_number as string) ||
    '';

  const amount = Number(data.amount || data.creditAmount || data.value || 0);

  if (!ref || !accountNumber || amount <= 0) {
    return null;
  }

  return {
    safe_haven_reference: ref,
    account_number: accountNumber,
    account_name: data.accountName as string || data.account_name as string || undefined,
    amount,
    sender_name: data.senderName as string || data.originatorName as string || data.sender_name as string || undefined,
    sender_account_number: data.senderAccountNumber as string || data.originatorAccountNumber as string || undefined,
    sender_bank_name: data.senderBankName as string || data.originatorBankName as string || undefined,
    narration: data.narration as string || data.description as string || data.paymentDescription as string || undefined,
    payment_reference: data.paymentReference as string || undefined,
  };
}

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/webhooks/safe-haven", RATE_LIMITS.WEBHOOK);
  if (limited) return limited;
  const startTime = Date.now();

  try {
    // 1. Verify webhook token (secret query parameter)
    if (!verifyWebhookToken(request)) {
      console.error('[Webhook] Invalid or missing token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get raw body
    const rawBody = await request.text();

    // 3. Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Webhook] Invalid JSON');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 4. Extract event metadata
    const externalEventId = extractExternalEventId(payload);
    const eventType = mapEventType(
      (payload.eventType as string) || (payload.type as string) || 'unknown'
    );

    // 5. Capture non-secret headers for audit
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!key.toLowerCase().includes('auth') && !key.toLowerCase().includes('cookie') && !key.toLowerCase().includes('signature')) {
        headers[key] = value;
      }
    });

    // 6. Store in inbound_events (append-only, idempotent)
    const supabase = getServiceClient();

    const { data: eventRecord, error: insertError } = await supabase
      .from('inbound_events')
      .insert({
        external_event_id: externalEventId,
        source: 'safe_haven',
        event_type: eventType,
        raw_payload: payload,
        raw_headers: headers,
        processing_status: 'received',
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        // Duplicate — already processed (idempotent)
        console.log('[Webhook] Duplicate event — skipping');
        return NextResponse.json({ status: 'duplicate', message: 'Event already received' }, { status: 200 });
      }
      console.error('[Webhook] Failed to store event:', insertError);
      return NextResponse.json({ error: 'Failed to store event' }, { status: 500 });
    }

    console.log(`[Webhook] Event stored: type=${eventType}, id=${eventRecord.id}, latency=${Date.now() - startTime}ms`);

    // 7. Process event based on type
    if (['transfer_completed', 'transfer_failed'].includes(eventType)) {
      // ── OUTBOUND TRANSFER (withdrawal reconciliation) ────────
      const paymentReference = extractPaymentReference(payload);

      if (paymentReference) {
        const { data: withdrawal } = await supabase
          .from('withdrawal_requests')
          .select('id, status')
          .eq('payment_reference', paymentReference)
          .in('status', ['pending', 'transfer_submitted', 'requires_reconciliation'])
          .maybeSingle();

        if (withdrawal) {
          console.log(`[Webhook] Triggering withdrawal reconciliation for ${withdrawal.id}`);
          try {
            const result = await reconcileWithdrawal(withdrawal.id);
            console.log(`[Webhook] Reconciliation: ${result.status} - ${result.message}`);
            await supabase
              .from('inbound_events')
              .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
              .eq('id', eventRecord.id);
          } catch (reconError) {
            console.error('[Webhook] Withdrawal reconciliation failed:', reconError);
            await supabase
              .from('inbound_events')
              .update({ processing_status: 'processing_failed', error_message: reconError instanceof Error ? reconError.message : 'Unknown' })
              .eq('id', eventRecord.id);
          }
        } else {
          await supabase
            .from('inbound_events')
            .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
            .eq('id', eventRecord.id);
        }

        // ── OUTBOUND TRANSFER (two-phase transfers table, Gate 4 P1) ──
        // The same event settles/reverses a matching `transfers` row. The
        // reconciliation is race-safe vs the cron: both use the same
        // claim-based optimistic locking and deterministic FTO idempotency
        // keys, so a single financial effect is guaranteed.
        const { data: transferRow } = await supabase
          .from('transfers')
          .select('id, status')
          .eq('payment_reference', paymentReference)
          .in('status', ['initiated', 'reserved', 'settling', 'reversing', 'pending', 'pending_settlement'])
          .maybeSingle();

        if (transferRow) {
          console.log(`[Webhook] Triggering transfer reconciliation for ${transferRow.id}`);
          try {
            const result = await reconcileTransfer(transferRow.id, 'webhook');
            console.log(`[Webhook] Transfer reconciliation: ${result.status} - ${result.message}`);
          } catch (transferReconError) {
            // Cron will retry — log and keep the event processed (the
            // reconciliation audit trail records the failure)
            console.error('[Webhook] Transfer reconciliation failed:', transferReconError);
          }
        }
      }
    } else if (['account_credit', 'transfer_received'].includes(eventType)) {
      // ── INCOMING CREDIT (wallet funding) ────────────────────
      const creditDetails = extractIncomingCredit(payload);

      if (creditDetails) {
        console.log(`[Webhook] Incoming credit: ₦${creditDetails.amount} to ${creditDetails.account_number} ref=${creditDetails.safe_haven_reference}`);

        // API RE-VERIFICATION: Verify the transaction with Safe Haven before crediting
        const verificationRef = creditDetails.payment_reference || creditDetails.safe_haven_reference;
        const verification = await verifyIncomingCreditWithSafeHaven(
          verificationRef,
          creditDetails.account_number,
          creditDetails.amount
        );

        if (verification === 'unverified') {
          console.error(`[Webhook] Safe Haven verification FAILED for ref=${verificationRef}`);
          await supabase
            .from('inbound_events')
            .update({
              processing_status: 'rejected',
              error_message: 'Safe Haven API verification failed — transaction not confirmed',
              processed_at: new Date().toISOString(),
            })
            .eq('id', eventRecord.id);
          return NextResponse.json({ status: 'rejected', message: 'Transaction verification failed' }, { status: 200 });
        }

        if (verification === 'indeterminate') {
          // QUARANTINE (Gate 4 P0 #5 — approved webhook quarantine policy):
          // verification API unavailable = transaction unconfirmed = no credit.
          // Event stays in inbound_events for retry; dedup guarantees a single
          // financial effect when it is eventually reprocessed.
          console.error(`[Webhook] Safe Haven verification UNAVAILABLE for ref=${verificationRef} — quarantining`);
          await supabase
            .from('inbound_events')
            .update({
              processing_status: 'processing_failed',
              error_message: 'Verification API unavailable — quarantined for retry, no credit posted',
            })
            .eq('id', eventRecord.id);
          return NextResponse.json({ status: 'quarantined', message: 'Verification unavailable — event quarantined for retry' }, { status: 200 });
        }

        try {
          const result = await processIncomingCredit(eventRecord.id, creditDetails);
          console.log(`[Webhook] Credit processing: ${result.status} - ${result.message} (${Date.now() - startTime}ms)`);

          if (result.status === 'failed') {
            await supabase
              .from('inbound_events')
              .update({
                processing_status: 'processing_failed',
                error_message: result.message,
              })
              .eq('id', eventRecord.id);
          }
        } catch (creditError) {
          console.error('[Webhook] Incoming credit processing failed:', creditError);
          await supabase
            .from('inbound_events')
            .update({
              processing_status: 'processing_failed',
              error_message: creditError instanceof Error ? creditError.message : 'Unknown',
            })
            .eq('id', eventRecord.id);
        }
      } else {
        console.warn('[Webhook] Could not extract credit details from payload');
        await supabase
          .from('inbound_events')
          .update({
            processing_status: 'failed',
            error_message: 'Could not extract credit details from payload',
          })
          .eq('id', eventRecord.id);
      }
    } else if (eventType === 'account_debit') {
      // ── OUTBOUND DEBIT (informational) ─────────────────────
      // Debit events are informational — outbound transfers are already
      // reconciled via transfer_completed/transfer_failed events.
      // We log the debit for audit trail completeness and mark as processed.
      const debitData = (payload.data || payload) as Record<string, unknown>;
      console.log(`[Webhook] Outbound debit: ₦${debitData.amount || 0} from ${debitData.accountNumber || 'unknown'}`);
      await supabase
        .from('inbound_events')
        .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', eventRecord.id);
    } else {
      // ── NON-FINANCIAL EVENTS ────────────────────────────────
      await supabase
        .from('inbound_events')
        .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', eventRecord.id);
    }

    // 8. Return 200 immediately (webhook best practice)
    return NextResponse.json({
      status: 'received',
      eventId: eventRecord.id,
      eventType,
    }, { status: 200 });

  } catch (error) {
    console.error(`[Webhook] Error after ${Date.now() - startTime}ms:`, error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'safe-haven-webhook',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}
