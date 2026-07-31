import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { reconcileWithdrawal } from '@/modules/withdrawal';
import { processIncomingCredit } from '@/modules/wallet/incoming-credit';

// ============================================================================
// Safe Haven Webhook Handler
//
// Receives webhooks from Safe Haven MFB for:
//   - Incoming bank transfer credits (account_credit / transfer_received)
//   - Outbound transfer completion/failure
//   - Identity verification completions
//
// Security:
//   1. Webhook signature verification (HMAC-SHA256)
//   2. Raw body preserved before any parsing
//   3. All events stored in inbound_events table (append-only landing zone)
//   4. Duplicate prevention via external_event_id unique constraint
//   5. Incoming credits → processIncomingCredit → Orchestrator → Ledger
//   6. Outbound transfers → reconcileWithdrawal
//
// Idempotency: A duplicated webhook must NEVER create duplicated funds.
// ============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function verifyWebhookSignature(signature: string, body: string): boolean {
  const webhookSecret = process.env.SAFE_HAVEN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Webhook] No SAFE_HAVEN_WEBHOOK_SECRET — accepting all (dev mode)');
    return true;
  }
  try {
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
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

/**
 * Extract incoming credit details from a Safe Haven credit/transfer webhook.
 * Safe Haven webhook payloads vary by event type — we handle common shapes.
 */
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
  
  const amount =
    Number(data.amount || data.creditAmount || data.value || 0);
  
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
    // 1. Get raw body BEFORE any parsing
    const rawBody = await request.text();

    // 2. Verify signature
    const signature = request.headers.get('x-safehaven-signature') || '';
    if (!verifyWebhookSignature(signature, rawBody)) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

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
        // Duplicate — already processed
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
      }
    } else if (['account_credit', 'transfer_received'].includes(eventType)) {
      // ── INCOMING CREDIT (wallet funding) ────────────────────
      const creditDetails = extractIncomingCredit(payload);

      if (creditDetails) {
        console.log(`[Webhook] Incoming credit: ₦${creditDetails.amount} to ${creditDetails.account_number} ref=${creditDetails.safe_haven_reference}`);
        
        try {
          const result = await processIncomingCredit(eventRecord.id, creditDetails);
          console.log(`[Webhook] Credit processing: ${result.status} - ${result.message} (${Date.now() - startTime}ms)`);

          // Event status is already updated by processIncomingCredit
          if (result.status === 'failed') {
            // Mark event as failed for retry
            await supabase
              .from('inbound_events')
              .update({ 
                processing_status: 'failed',
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
