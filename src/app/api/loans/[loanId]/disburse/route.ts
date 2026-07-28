import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { disburseLoan } from '@/modules/loans';

// POST /api/loans/[loanId]/disburse — disburse an approved loan (staff only)
export async function POST(
  request: NextRequest,
  context: { params: { loanId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!isStaff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const result = await disburseLoan(context.params.loanId);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API:loan-disburse] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
