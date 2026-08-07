import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';

export async function GET(
  request: NextRequest,
  context: { params: { ticketId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/support/detail', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const serviceClient = createServiceClient();
    const ticketId = context.params.ticketId;

    const { data: ticket, error } = await serviceClient
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (error || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const { data: messages } = await serviceClient
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    return NextResponse.json({ ticket, messages: messages || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { ticketId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/support/action', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id, role, full_name')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const body = await request.json();
    const { action, reason } = body;
    const ticketId = context.params.ticketId;

    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    const serviceClient = createServiceClient();
    const { data: before } = await serviceClient
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'assign':
        updateData = { assigned_to: user.id, assigned_name: staff.full_name, status: 'assigned' };
        break;
      case 'unassign':
        updateData = { assigned_to: null, assigned_name: null, status: 'open' };
        break;
      case 'start_progress':
        updateData = { status: 'in_progress' };
        break;
      case 'wait_customer':
        updateData = { status: 'waiting_customer' };
        break;
      case 'resolve':
        updateData = { status: 'resolved', resolved_at: new Date().toISOString() };
        break;
      case 'close':
        updateData = { status: 'closed', closed_at: new Date().toISOString() };
        break;
      case 'reopen':
        updateData = { status: 'reopened', resolved_at: null, reopened_count: (before.reopened_count || 0) + 1 };
        break;
      case 'update_priority':
        updateData = { priority: body.priority || before.priority };
        break;
      case 'update_category':
        updateData = { category: body.category || before.category };
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select('*')
      .single();

    if (updateError) throw new Error(updateError.message);

    await logAdminAction({
      admin_user_id: staff.id,
      admin_role: staff.role,
      action,
      action_category: 'support',
      entity_type: 'support_ticket',
      entity_id: ticketId,
      before_state: before,
      after_state: updateData,
      metadata: { reason },
    });

    return NextResponse.json({ success: true, ticket: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
