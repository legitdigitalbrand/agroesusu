import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getSavingsBalance } from '@/modules/savings';

// GET /api/savings/accounts/[accountId] — get account details + balance
export async function GET(
  _request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const account = await getAccount(context.params.accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Verify ownership (customer) or staff permission
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    const isOwner = customer && account.customer_id === customer.id;
    const { data: isStaff } = await supabase.rpc('is_staff');

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get balance from Ledger
    const balance = await getSavingsBalance(context.params.accountId);

    return NextResponse.json({
      account: {
        ...account,
        balance,
      },
    });

  } catch (error) {
    console.error('[API:savings-account] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
