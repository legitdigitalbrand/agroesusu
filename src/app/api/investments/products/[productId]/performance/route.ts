import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordPoolPerformance, getPoolPerformanceRecords } from '@/modules/investments';

export async function GET(
  _request: NextRequest,
  context: { params: { productId: string } }
) {
  try {
    const records = await getPoolPerformanceRecords(context.params.productId);
    return NextResponse.json({ performance_records: records });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { productId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin permissions
    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await request.json();
    const {
      performance_date, period_start, period_end,
      total_pool_value, total_returns, return_rate,
      expense_ratio, source_description, supporting_notes, source_reference,
    } = body;

    if (!performance_date || !period_start || !period_end || !total_pool_value ||
        total_returns === undefined || return_rate === undefined || !source_description) {
      return NextResponse.json({ error: 'Missing required fields: performance_date, period_start, period_end, total_pool_value, total_returns, return_rate, source_description' }, { status: 400 });
    }

    const record = await recordPoolPerformance({
      product_id: context.params.productId,
      performance_date,
      period_start,
      period_end,
      total_pool_value: Number(total_pool_value),
      total_returns: Number(total_returns),
      return_rate: Number(return_rate),
      expense_ratio: expense_ratio ? Number(expense_ratio) : 0,
      source_description,
      supporting_notes: supporting_notes || undefined,
      source_reference: source_reference || undefined,
      entered_by: user.id,
    });

    return NextResponse.json({ performance_record: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
