import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(
  request: NextRequest,
  context: { params: { customerId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/customers/timeline', RATE_LIMITS.ADMIN);
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
    const customerId = context.params.customerId;

    // Fetch customer to get auth_id
    const { data: customer } = await serviceClient
      .from('customers')
      .select('auth_id')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Fetch audit log entries
    const { data: auditLogs } = await serviceClient
      .from('audit_log')
      .select('id, action, entity_type, entity_id, metadata, created_at, user_id')
      .eq('user_id', customer.auth_id)
      .order('created_at', { ascending: false })
      .limit(25);

    // Fetch admin action log entries
    const { data: adminLogs } = await serviceClient
      .from('admin_action_log')
      .select('id, action, action_category, entity_type, entity_id, metadata, created_at, admin_user_id')
      .eq('entity_id', customerId)
      .order('created_at', { ascending: false })
      .limit(25);

    // Normalize and merge
    const auditEvents = (auditLogs || []).map(e => ({
      id: e.id,
      type: 'audit',
      action: e.action,
      entity_type: e.entity_type,
      metadata: e.metadata,
      timestamp: e.created_at,
      actor: e.user_id,
    }));

    const adminEvents = (adminLogs || []).map(e => ({
      id: e.id,
      type: 'admin',
      action: e.action,
      entity_type: e.entity_type,
      metadata: e.metadata,
      timestamp: e.created_at,
      actor: e.admin_user_id,
    }));

    const events = [...auditEvents, ...adminEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
