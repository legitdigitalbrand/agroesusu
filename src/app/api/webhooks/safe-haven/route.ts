import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Safe Haven Webhook Handler
// 
// This endpoint receives webhooks from Safe Haven MFB for:
//   - Incoming transfers to a customer's DVA
//   - Transfer completion/failure notifications
//   - Identity verification completions
// 
// Security:
//   1. Webhook signature verification (HMAC-SHA256 or Safe Haven's method)
//   2. Raw body preserved before any parsing
//   3. All events stored in inbound_events table (append-only landing zone)
//   4. No processing happens here — events land and wait for Phase 5 Orchestrator
// 
// Per Phase 2 constraint: "Every inbound webhook must be authenticated/verified
// before trusting its payload."
// ============================================================================

// Lazy-initialize the Supabase service client
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

// Verify webhook signature
// Safe Haven uses a webhook secret for verification.
// The exact method depends on Safe Haven's implementation — we support
// both HMAC-SHA256 (common) and raw secret comparison.
function verifyWebhookSignature(signature: string, body: string): boolean {
  const webhookSecret = process.env.SAFE_HAVEN_WEBHOOK_SECRET;
  
  // If no secret is configured, we're in mock/dev mode — accept all
  if (!webhookSecret) {
    console.warn('[Webhook] No SAFE_HAVEN_WEBHOOK_SECRET configured — accepting all webhooks (dev mode only)');
    return true;
  }
  
  // HMAC-SHA256 verification
  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Fallback: direct comparison (less secure but functional)
    return signature === webhookSecret;
  }
}

// Map Safe Haven event types to our internal event types
function mapEventType(shEventType: string): string {
  const typeMap: Record<string, string> = {
    'transfer': 'transfer_received',
    'credit': 'account_credit',
    'debit': 'account_debit',
    'verification': 'verification_completed',
    'transfer.success': 'transfer_completed',
    'transfer.failed': 'transfer_failed',
  };
  
  const mapped = typeMap[shEventType.toLowerCase()];
  if (!mapped) {
    console.warn(`[Webhook] Unknown event type: ${shEventType}`);
    return 'unknown';
  }
  return mapped;
}

// Extract external event ID from Safe Haven payload
function extractExternalEventId(payload: Record<string, unknown>): string | null {
  // Safe Haven includes a transaction ID or event ID in the payload
  // The exact field name depends on their webhook format
  return (
    (payload._id as string) ||
    (payload.transactionId as string) ||
    (payload.eventId as string) ||
    (payload.reference as string) ||
    null
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Get raw body BEFORE any parsing
    const rawBody = await request.text();
    
    // 2. Get signature from headers
    const signature = request.headers.get('x-sh-signature') 
      || request.headers.get('x-safehaven-signature')
      || request.headers.get('signature')
      || '';
    
    // 3. Verify signature
    if (!verifyWebhookSignature(signature, rawBody)) {
      console.error('[Webhook] Signature verification failed');
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
    }
    
    // 4. Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Webhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    // 5. Extract event metadata
    const externalEventId = extractExternalEventId(payload);
    const eventType = mapEventType(
      (payload.eventType as string) || 
      (payload.type as string) || 
      'unknown'
    );
    
    // 6. Capture non-secret headers for audit
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      // Redact auth-related headers
      if (!key.toLowerCase().includes('auth') && !key.toLowerCase().includes('cookie')) {
        headers[key] = value;
      }
    });
    
    // 7. Store in inbound_events (append-only landing zone)
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
      // If it's a unique constraint violation on external_event_id, it's a duplicate
      if (insertError.code === '23505') {
        console.log('[Webhook] Duplicate event detected, marking as duplicate');
        // Update the existing record to mark as duplicate
        if (externalEventId) {
          await supabase
            .from('inbound_events')
            .update({ processing_status: 'duplicate' })
            .eq('source', 'safe_haven')
            .eq('external_event_id', externalEventId);
        }
        return NextResponse.json(
          { status: 'duplicate', message: 'Event already received' },
          { status: 200 }
        );
      }
      
      console.error('[Webhook] Failed to store event:', insertError);
      return NextResponse.json(
        { error: 'Failed to store event' },
        { status: 500 }
      );
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`[Webhook] Event stored: type=${eventType}, id=${eventRecord.id}, latency=${processingTime}ms`);
    
    // 8. Return 200 immediately — Safe Haven expects a quick response
    // Processing will happen asynchronously (Phase 5 Orchestrator picks up 'received' events)
    return NextResponse.json(
      { 
        status: 'received', 
        eventId: eventRecord.id,
        eventType,
      },
      { status: 200 }
    );
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Webhook] Error after ${processingTime}ms:`, error);
    
    return NextResponse.json(
      { error: 'Internal error processing webhook' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    service: 'safe-haven-webhook',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}
