import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/credit-scores', RATE_LIMITS.ADMIN);
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
    const riskLevel = searchParams.get('risk_level') || '';
    const minScore = searchParams.get('min_score');
    const maxScore = searchParams.get('max_score');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    let query = serviceClient
      .from('customer_risk_profiles')
      .select('*', { count: 'exact' });

    if (riskLevel && riskLevel !== 'all') query = query.eq('risk_level', riskLevel);
    if (minScore) query = query.gte('internal_credit_score', parseInt(minScore));
    if (maxScore) query = query.lte('internal_credit_score', parseInt(maxScore));

    query = query.order('internal_credit_score', { ascending: true }).range(skip, skip + limit - 1);
    const { data: profiles, error, count } = await query;

    if (error) throw new Error(error.message);

    // Enrich with customer names
    const enriched = await Promise.all((profiles || []).map(async (p) => {
      const { data: customer } = await serviceClient
        .from('customers')
        .select('full_name, customer_number, email, phone, status')
        .eq('id', p.customer_id)
        .maybeSingle();
      return { ...p, customer: customer || null };
    }));

    return NextResponse.json({ profiles: enriched, total: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
