import { NextRequest, NextResponse } from 'next/server';
import { getGroupSavingsAccount, getGroupMembers, getGroupPoolBalance, getEsusuByGroupAccount } from '@/modules/cooperative';
import { requireAuth } from '@/lib/auth/api-guard';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const { user, customerId, isStaff } = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify the user is a member of this group (or staff)
    if (!isStaff && customerId) {
      const supabase = createClient();
      const { data: membership } = await supabase
        .from('group_savings_memberships')
        .select('id')
        .eq('group_account_id', context.params.accountId)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .maybeSingle();
      if (!membership) return NextResponse.json({ error: 'Forbidden: not a member of this group' }, { status: 403 });
    }

    const account = await getGroupSavingsAccount(context.params.accountId);
    if (!account) return NextResponse.json({ error: 'Group savings account not found' }, { status: 404 });
    const members = await getGroupMembers(context.params.accountId);
    const poolBalance = await getGroupPoolBalance(context.params.accountId);
    const esusuGroup = await getEsusuByGroupAccount(context.params.accountId);
    return NextResponse.json({ account, members, pool_balance: poolBalance, esusu_group: esusuGroup });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
