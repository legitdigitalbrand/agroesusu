import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWithdrawal } from '@/modules/withdrawal';

export async function GET(
  _request: NextRequest,
  { params }: { params: { withdrawalId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const withdrawal = await getWithdrawal(params.withdrawalId);

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer || withdrawal.customer_id !== customer.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ withdrawal });
  } catch (error) {
    console.error('[API] Get withdrawal error:', error);
    return NextResponse.json({ error: 'Failed to load withdrawal' }, { status: 500 });
  }
}
