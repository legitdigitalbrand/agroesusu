import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { contributeToGroup } from '@/modules/cooperative';

export async function POST(
  request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { wallet_id, amount } = body;
    if (!wallet_id || !amount || amount <= 0) return NextResponse.json({ error: 'wallet_id and positive amount are required' }, { status: 400 });

    const result = await contributeToGroup(context.params.accountId, wallet_id, Number(amount));
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, transaction_reference: result.transaction_reference }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
