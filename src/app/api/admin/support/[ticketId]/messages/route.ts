import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(
  request: NextRequest,
  context: { params: { ticketId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/support/messages', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id, full_name')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const body = await request.json();
    const { message, is_internal_note } = body;
    const ticketId = context.params.ticketId;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Insert message
    const { data: msg, error } = await serviceClient
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'staff',
        sender_id: user.id,
        sender_name: staff.full_name,
        message: message.trim(),
        is_internal_note: is_internal_note || false,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    // Update ticket: set first_response_at if not set, and update status
    const { data: ticket } = await serviceClient
      .from('support_tickets')
      .select('first_response_at, status')
      .eq('id', ticketId)
      .maybeSingle();

    if (ticket) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (!ticket.first_response_at) {
        updates.first_response_at = new Date().toISOString();
      }
      if (ticket.status === 'open' || ticket.status === 'assigned') {
        updates.status = 'in_progress';
      }
      await serviceClient.from('support_tickets').update(updates).eq('id', ticketId);
    }

    return NextResponse.json({ message: msg }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
