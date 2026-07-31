import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileWithdrawal } from '@/modules/withdrawal';

// ============================================================================
// Safe Haven Webhook Handler
//
// Receives webhooks from Safe Haven MFB for:
//   - Transfer completion/failure notifications
//   - Account credit/debit events
//   - Identity verification completions
//
// Security:
//   1. Webhook signature verification (HMAC-SHA256)
//   2. Raw body preserved before any parsing
//   3. All events stored in inbound_events table (append-only landing zone)
//   4. Duplicate prevention via external_event_id unique constraint
//   5. Transfer events trigger withdrawal reconciliation
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

/**
 * Extract the payment reference from a transfer webhook payload.
 * Safe Haven includes the paymentReference we sent with the transfer request.
 */
function extractPaymentReference(payload: Record<string, unknown>): string | null {
  // Check top-level fields
  if (payload.paymentReference) return payload.paymentReference as string;
  if (payload.reference) return payload.reference as string;
  // Check nested data object
  if (payload.data && typeof payload.data === 'object') {
    const dataObj = payload.data as Record<string, unknown>;
    if (dataObj.paymentReference) return dataObj.paymentReference as string;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Get raw body BEFORE parsing
    const rawBody = await request.text();

    // 2. Get signature from headers
    const signature = request.headers.get('x-sh-signature')
      || request.headers.get('x-safehaven-signature')
      || request.headers.get('signature')
      || '';

    // 3. Verify signature
    if (!verifyWebhookSignature(signature, rawBody)) {
      console.error('[Webhook] Signature verification failed');
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // 4. Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Webhook] Invalid JSON');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 5. Extract event metadata
    const externalEventId = extractExternalEventId(payload);
    const eventType = mapEventType(
      (payload.eventType as string) || (payload.type as string) || 'unknown'
    );

    // 6. Capture non-secret headers for audit
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!key.toLowerCase().includes('auth') && !key.toLowerCase().includes('cookie')) {
        headers[key] = value;
      }
    });

    // 7. Store in inbound_events (append-only, idempotent)
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

    // 8. Process transfer-related events
    if (['transfer_completed', 'transfer_failed'].includes(eventType)) {
      const paymentReference = extractPaymentReference(payload);

      if (paymentReference) {
        // Find the withdrawal request by payment reference
        const { data: withdrawal } = await supabase
          .from('withdrawal_requests')
          .select('id, status')
          .eq('payment_reference', paymentReference)
          .in('status', ['pending', 'transfer_submitted', 'requires_reconciliation'])
          .maybeSingle();

        if (withdrawal) {
          console.log(`[Webhook] Triggering reconciliation for withdrawal ${withdrawal.id}`);
          try {
            const result = await reconcileWithdrawal(withdrawal.id);
            console.log(`[Webhook] Reconciliation result: ${result.status} - ${result.message}`);

            // Mark event as processed
            await supabase
              .from('inbound_events')
              .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
              .eq('id', eventRecord.id);
          } catch (reconError) {
            console.error('[Webhook] Reconciliation failed:', reconError);
            // Mark for retry
            await supabase
              .from('inbound_events')
              .update({ processing_status: 'processing_failed', processing_error: reconError instanceof Error ? reconError.message : 'Unknown' })
              .eq('id', eventRecord.id);
          }
        } else {
          console.log(`[Webhook] No pending withdrawal for payment reference ${paymentReference}`);
          await supabase
            .from('inbound_events')
            .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
            .eq('id', eventRecord.id);
        }
      }
    } else {
      // Non-transfer events: mark as processed (no action needed yet)
      await supabase
        .from('inbound_events')
        .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', eventRecord.id);
    }

    // 9. Return 200 immediately
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
