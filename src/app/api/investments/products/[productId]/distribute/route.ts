import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { distributePoolReturns } from '@/modules/investments';

export async function POST(
  request: NextRequest,
  _context: { params: { productId: string } }
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
    const { performance_record_id } = body;
    if (!performance_record_id) {
      return NextResponse.json({ error: 'performance_record_id is required' }, { status: 400 });
    }

    const result = await distributePoolReturns(performance_record_id, user.id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({
      success: true,
      total_distributed: result.total_distributed,
      contributor_count: result.contributor_count,
      distributions: result.distributions,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred. Please try again or contact support.' }, { status: 500 });
  }
}
