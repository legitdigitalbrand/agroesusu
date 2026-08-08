import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/fraud', RATE_LIMITS.ADMIN);
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
    const severity = searchParams.get('severity') || '';
    const flagType = searchParams.get('type') || '';
    const assigned = searchParams.get('assigned') || '';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    let query = serviceClient
      .from('fraud_flags')
      .select('*', { count: 'exact' });

    if (status && status !== 'all') query = query.eq('status', status);
    if (severity && severity !== 'all') query = query.eq('severity', severity);
    if (flagType && flagType !== 'all') query = query.eq('flag_type', flagType);
    if (assigned === 'me') query = query.eq('assigned_to', user.id);
    if (assigned === 'unassigned') query = query.is('assigned_to', null);
    if (search) {
      query = query.or(`title.ilike.%${search}%,flag_id.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(skip, skip + limit - 1);
    const { data: flags, error, count } = await query;

    if (error) throw new Error(error.message);

    // Get summary stats
    const { count: openCount } = await serviceClient
      .from('fraud_flags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    const { count: investigatingCount } = await serviceClient
      .from('fraud_flags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'investigating');

    const { count: criticalCount } = await serviceClient
      .from('fraud_flags')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .in('status', ['open', 'investigating']);

    const { count: confirmedCount } = await serviceClient
      .from('fraud_flags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed');

    return NextResponse.json({
      flags: flags || [],
      total: count || 0,
      stats: {
        open: openCount || 0,
        investigating: investigatingCount || 0,
        critical: criticalCount || 0,
        confirmed: confirmedCount || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/fraud', RATE_LIMITS.ADMIN);
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
    const { customer_id, customer_name, title, description, flag_type, severity, transaction_id, wallet_id } = body;

    if (!title || !description || !flag_type) {
      return NextResponse.json({ error: 'Title, description, and flag type are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: flag, error } = await serviceClient
      .from('fraud_flags')
      .insert({
        customer_id: customer_id || null,
        customer_name: customer_name || null,
        title,
        description,
        flag_type,
        severity: severity || 'medium',
        status: 'open',
        detected_by: staff.full_name,
        transaction_id: transaction_id || null,
        wallet_id: wallet_id || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await logAdminAction({
      admin_user_id: staff.id,
      admin_role: staff.role,
      action: 'create_fraud_flag',
      action_category: 'fraud',
      entity_type: 'fraud_flag',
      entity_id: flag.id,
      after_state: { title, flag_type, severity },
      metadata: { reason: description },
    });

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
