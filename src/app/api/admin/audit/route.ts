import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { queryAuditLog, queryGovernanceAuditLog, queryAdminActionLog, getAuditLogSummary } from '@/modules/reporting';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/admin/audit", RATE_LIMITS.ADMIN);
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

    const { searchParams } = new URL(request.url);
    const logType = searchParams.get('log_type') || 'audit';
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      const summaryData = await getAuditLogSummary();
      return NextResponse.json(summaryData);
    }

    const query = {
      actor_id: searchParams.get('actor_id') || undefined,
      action: searchParams.get('action') || undefined,
      entity_type: searchParams.get('entity_type') || undefined,
      entity_id: searchParams.get('entity_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      result: searchParams.get('result') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
    };

    let result;
    if (logType === 'governance') {
      result = await queryGovernanceAuditLog(query);
    } else if (logType === 'admin') {
      result = await queryAdminActionLog(query);
    } else {
      result = await queryAuditLog(query);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
