import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const limited = applyRateLimit(request, "/api/admin/reports", RATE_LIMITS.ADMIN);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id, roles(name)')
      .eq('auth_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    // Get available reports for this user's role
    const roleName = ((staff as { roles: { name: string }[] }).roles as { name: string }[])?.[0]?.name || 'customer_support';
    const { data: reports } = await supabase
      .from('report_definitions')
      .select('*')
      .eq('is_active', true)
      .contains('allowed_roles', [roleName])
      .order('report_category');

    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
