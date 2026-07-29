import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLoan, getSchedule, acceptAgreement } from '@/modules/loans';

// GET /api/loans/[loanId] — loan details + schedule
export async function GET(
  _request: NextRequest,
  context: { params: { loanId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const loan = await getLoan(context.params.loanId);
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    // Verify ownership
    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!isStaff && (!customer || loan.customer_id !== customer.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schedule = await getSchedule(context.params.loanId);
    return NextResponse.json({ loan, schedule });
  } catch (error) {
    console.error('[API:loan-detail] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/loans/[loanId] — accept loan agreement
export async function POST(
  request: NextRequest,
  context: { params: { loanId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    await acceptAgreement(context.params.loanId, body.ip_address);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API:loan-accept] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
