import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveUnmatchedCredit, reverseUnmatchedCredit } from '@/modules/wallet/incoming-credit';

// GET /api/admin/reconciliation — list unmatched credits and pending events
export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/admin/reconciliation", RATE_LIMITS.ADMIN);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden — staff access required' }, { status: 403 });
    }

    const serviceClient = createServiceClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'requires_reconciliation';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Fetch unmatched credits
    const { data: unmatchedCredits, error: creditsError } = await serviceClient
      .from('unmatched_credits')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (creditsError) {
      return NextResponse.json({ error: 'Failed to fetch unmatched credits' }, { status: 500 });
    }

    // Also fetch failed inbound events
    const { data: failedEvents } = await serviceClient
      .from('inbound_events')
      .select('id, event_type, processing_status, error_message, received_at, correlation_id')
      .in('processing_status', ['failed', 'processing_failed'])
      .order('received_at', { ascending: false })
      .limit(limit);

    // Fetch reconciliation flags
    const { data: reconFlags } = await serviceClient
      .from('reconciliation_flags')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(limit);

    return NextResponse.json({
      unmatched_credits: unmatchedCredits || [],
      failed_events: failedEvents || [],
      reconciliation_flags: reconFlags || [],
      summary: {
        unmatched: (unmatchedCredits || []).length,
        failed_events: (failedEvents || []).length,
        recon_flags: (reconFlags || []).length,
      },
    });

  } catch (error) {
    console.error('[API:admin-reconciliation] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/reconciliation — resolve an unmatched credit
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden — staff access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, unmatched_credit_id, customer_id, wallet_id, reason } = body;

    if (!action || !unmatched_credit_id) {
      return NextResponse.json({ error: 'action and unmatched_credit_id are required' }, { status: 400 });
    }

    if (!reason || reason.length < 10) {
      return NextResponse.json({ error: 'A meaningful reason (min 10 chars) is required' }, { status: 400 });
    }

    // Log admin action
    const serviceClient = createServiceClient();
    await serviceClient.from('admin_action_log').insert({
      staff_user_id: user.id,
      action: `reconciliation:${action}`,
      entity_type: 'unmatched_credit',
      entity_id: unmatched_credit_id,
      reason,
      metadata: { customer_id, wallet_id },
    });

    if (action === 'match') {
      if (!customer_id || !wallet_id) {
        return NextResponse.json({ error: 'customer_id and wallet_id required for match action' }, { status: 400 });
      }

      const result = await resolveUnmatchedCredit(
        unmatched_credit_id,
        customer_id,
        wallet_id,
        user.id,
        reason
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Credit matched and wallet credited',
        ft_id: result.ft_id,
      });
    } else if (action === 'reverse') {
      const result = await reverseUnmatchedCredit(unmatched_credit_id, user.id, reason);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Credit reversed — funds to be returned to sender',
      });
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "match" or "reverse".' }, { status: 400 });
    }

  } catch (error) {
    console.error('[API:admin-reconciliation] POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
