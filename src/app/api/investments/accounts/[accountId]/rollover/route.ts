import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rolloverInvestment } from '@/modules/investments';

export async function POST(
  request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });

    const body = await request.json();
    const { wallet_id, new_tenure_days } = body;
    if (!wallet_id) return NextResponse.json({ error: 'wallet_id is required' }, { status: 400 });

    const result = await rolloverInvestment({
      investment_account_id: context.params.accountId,
      wallet_id,
      new_tenure_days: new_tenure_days ? Number(new_tenure_days) : undefined,
    });

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, new_account_id: result.new_account_id, transaction_reference: result.transaction_reference });
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred. Please try again or contact support.' }, { status: 500 });
  }
}
