import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/admin/transactions', RATE_LIMITS.ADMIN);
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
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const minAmount = searchParams.get('min_amount');
    const maxAmount = searchParams.get('max_amount');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    let query = serviceClient
      .from('financial_transactions')
      .select('id, transaction_reference, transaction_type, source_module, source_reference, status, amount, currency, description, wallet_id, journal_entry_id, correlation_id, metadata, reverses, reversed_by, reversal_reason, validation_errors, initiated_at, validated_at', { count: 'exact' });

    if (search) {
      query = query.ilike('transaction_reference', `%${search}%`);
    }
    if (type && type !== 'all') {
      query = query.eq('transaction_type', type);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (dateFrom) {
      query = query.gte('initiated_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('initiated_at', dateTo + 'T23:59:59');
    }
    if (minAmount) {
      query = query.gte('amount', parseFloat(minAmount));
    }
    if (maxAmount) {
      query = query.lte('amount', parseFloat(maxAmount));
    }

    query = query.order('initiated_at', { ascending: false }).range(skip, skip + limit - 1);
    const { data: transactions, error, count } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({ transactions: transactions || [], total: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
