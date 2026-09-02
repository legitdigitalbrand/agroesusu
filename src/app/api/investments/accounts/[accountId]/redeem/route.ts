import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redeem } from '@/modules/investments';

export async function POST(
  request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { wallet_id, amount, is_partial } = body;
    if (!wallet_id) return NextResponse.json({ error: 'wallet_id is required' }, { status: 400 });

    const result = await redeem({
      investment_account_id: context.params.accountId,
      wallet_id,
      amount: amount ? Number(amount) : undefined,
      is_partial: is_partial || false,
    });

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, transaction_reference: result.transaction_reference, redeemed_amount: result.redeemed_amount });
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred. Please try again or contact support.' }, { status: 500 });
  }
}
