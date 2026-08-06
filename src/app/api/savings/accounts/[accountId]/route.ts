import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getSavingsBalance, getGoalByAccountId, calculateProgress } from '@/modules/savings';

// GET /api/savings/accounts/[accountId] — get account details + balance + goal metadata
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

    // Get goal metadata if this is a custom_pot
    const accountType = account.product?.product_type || 'flexible';
    let goalData: Record<string, unknown> | undefined;
    if (accountType === 'custom_pot') {
      const goal = await getGoalByAccountId(context.params.accountId);
      if (goal) {
        goalData = {
          name: goal.pot_name,
          target: goal.target_amount,
          progress: calculateProgress(balance, goal.target_amount),
          target_date: goal.target_date,
          monthly_target: goal.monthly_target,
          goal_status: goal.status,
          goal_id: goal.goal_id,
        };
      }
    }

    return NextResponse.json({
      account: {
        ...account,
        interest_earned: account.total_interest_earned || 0,
        current_balance: balance,
        available_balance: balance,
        locked_balance: 0,
        goal: goalData,
        type: accountType === 'custom_pot' ? 'goal' : 'flexible',
      },
    });

  } catch (error) {
    console.error('[API:savings-account] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
