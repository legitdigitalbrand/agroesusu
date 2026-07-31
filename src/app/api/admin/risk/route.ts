import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { getRiskReport, getInvestmentPoolPerformance } from '@/modules/reporting';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/admin/risk", RATE_LIMITS.ADMIN);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const viewType = searchParams.get('type') || 'all';

    const result: Record<string, unknown> = {};

    if (viewType === 'all' || viewType === 'portfolio') {
      result.risk_report = await getRiskReport();
    }
    if (viewType === 'all' || viewType === 'investments') {
      result.investment_pool_performance = await getInvestmentPoolPerformance();
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
