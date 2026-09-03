import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileStaleTransfers, DEFAULT_STALE_THRESHOLD_MINUTES } from '@/modules/transfers';

// ============================================================================
// Cron Endpoint: Reconcile Stale Pending Transfers
//
// Triggered every 15 minutes by Vercel Cron (vercel.json).
//
// A transfer that Safe Haven returned `pending` keeps the customer's funds
// reserved in escrow (Phase 1 posted, Phase 2 waiting for the webhook). If
// the webhook is delayed, lost, or never delivered, this cron is the safety
// net: it re-examines stale transfers against the authoritative provider
// status and settles, reverses, or retains them.
//
// Race-safe vs webhook/manual reconciliation: claim-based optimistic locking
// + deterministic FTO idempotency keys — a single financial effect regardless
// of how many reconcilers run.
//
// Authentication: CRON_SECRET header
// ============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Service client must be constructible (env sanity) — forces a clear
    // error instead of silent no-ops if env vars are missing.
    getServiceClient();

    // Threshold configurable via query param, e.g. ?staleMinutes=30
    const url = new URL(request.url);
    const staleMinutes = Number(url.searchParams.get('staleMinutes')) || DEFAULT_STALE_THRESHOLD_MINUTES;

    const { processed, results } = await reconcileStaleTransfers(staleMinutes, 'cron');

    const byOutcome = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`[Cron:reconcile-transfers] processed=${processed} outcomes=${JSON.stringify(byOutcome)}`);

    return NextResponse.json({
      status: 'success',
      processed,
      outcomes: byOutcome,
      stale_threshold_minutes: staleMinutes,
      results: results.map(r => ({
        transfer_id: r.transfer_id,
        reference: r.reference,
        status: r.status,
        message: r.message,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron:reconcile-transfers] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
