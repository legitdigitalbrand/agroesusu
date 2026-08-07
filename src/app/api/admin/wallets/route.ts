import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/wallets', RATE_LIMITS.ADMIN);
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
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    let query = serviceClient
      .from('wallets')
      .select('id, user_id, account_number, account_name, bank_name, balance, created_at, updated_at, safe_haven_customer_id', { count: 'exact' });

    if (search) {
      query = query.or(`account_number.ilike.%${search}%,account_name.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(skip, skip + limit - 1);
    const { data: wallets, error, count } = await query;

    if (error) throw new Error(error.message);

    // Enrich with customer names
    const enriched = await Promise.all((wallets || []).map(async (w) => {
      const { data: customer } = await serviceClient
        .from('customers')
        .select('full_name, customer_number, status')
        .eq('auth_id', w.user_id)
        .maybeSingle();

      return {
        ...w,
        customer_name: customer?.full_name || 'Unknown',
        customer_number: customer?.customer_number || '',
        customer_status: customer?.status || 'unknown',
      };
    }));

    return NextResponse.json({ wallets: enriched, total: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
