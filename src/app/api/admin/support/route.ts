import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/support', RATE_LIMITS.ADMIN);
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const category = searchParams.get('category') || '';
    const assigned = searchParams.get('assigned') || '';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    let query = serviceClient
      .from('support_tickets')
      .select('*', { count: 'exact' });

    if (status && status !== 'all') query = query.eq('status', status);
    if (priority && priority !== 'all') query = query.eq('priority', priority);
    if (category && category !== 'all') query = query.eq('category', category);
    if (assigned === 'me') query = query.eq('assigned_to', user.id);
    if (assigned === 'unassigned') query = query.is('assigned_to', null);
    if (search) {
      query = query.or(`subject.ilike.%${search}%,ticket_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(skip, skip + limit - 1);
    const { data: tickets, error, count } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({ tickets: tickets || [], total: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/support', RATE_LIMITS.ADMIN);
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
    const { customer_id, customer_name, customer_email, customer_phone, subject, description, category, priority } = body;

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: ticket, error } = await serviceClient
      .from('support_tickets')
      .insert({
        customer_id: customer_id || null,
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        subject,
        description,
        category: category || 'general',
        priority: priority || 'medium',
        status: 'open',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    // Add initial message
    await serviceClient.from('support_ticket_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'staff',
      sender_id: user.id,
      sender_name: staff.full_name,
      message: description,
      is_internal_note: false,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
