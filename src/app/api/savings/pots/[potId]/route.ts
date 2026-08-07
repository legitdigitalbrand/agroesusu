import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateGoal, getSavingsBalance } from '@/modules/savings';

// PATCH /api/savings/pots/[potId] — update goal metadata on a savings account
// potId here is the savings account ID
//
// Body (all optional):
//   pot_name?: string         — rename the goal
//   target_amount?: number   — change target
//   target_date?: string     — change target date (or null to clear)
//   monthly_target?: number  — change monthly target (or null to clear)
//   status?: 'active' | 'archived' — archive (close account)
export async function PATCH(
  request: NextRequest,
  context: { params: { potId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const accountId = context.params.potId;

    // Verify the savings account belongs to this customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const { data: account } = await supabase
      .from('savings_accounts')
      .select('id, customer_id, status, goal_enabled')
      .eq('id', accountId)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: 'Savings account not found' }, { status: 404 });
    }

    const { data: isStaff } = await supabase.rpc('is_staff');
    if (account.customer_id !== customer.id && !isStaff) {
      return NextResponse.json({ error: 'Forbidden: not your savings account' }, { status: 403 });
    }

    // If trying to archive, check balance
    if (body.status === 'archived') {
      const balance = await getSavingsBalance(accountId);
      if (balance > 0) {
        return NextResponse.json({
          error: 'Cannot archive a savings goal with a positive balance. Please withdraw all funds first.',
        }, { status: 400 });
      }
    }

    // Build updates for updateGoal
    const updates: {
      pot_name?: string;
      target_amount?: number;
      target_date?: string | null;
      monthly_target?: number | null;
      status?: 'active' | 'archived';
    } = {};

    if (body.pot_name !== undefined) updates.pot_name = body.pot_name;
    if (body.target_amount !== undefined) updates.target_amount = body.target_amount;
    if (body.target_date !== undefined) updates.target_date = body.target_date;
    if (body.monthly_target !== undefined) updates.monthly_target = body.monthly_target;
    if (body.status !== undefined) updates.status = body.status;

    const updatedGoal = await updateGoal(accountId, updates);

    return NextResponse.json({ goal: updatedGoal });

  } catch (error) {
    console.error('[API:savings-pot-update] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
