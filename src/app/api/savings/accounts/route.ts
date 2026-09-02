import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { openAccount, listCustomerAccounts, deposit, getSavingsBalance, getGoalsForAccounts, calculateProgress } from '@/modules/savings';

// POST /api/savings/accounts — open a new savings account
// Supports flexible (with optional goal tracking) and fixed deposit
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/savings/accounts", RATE_LIMITS.SAVINGS);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      product_id, 
      target_amount, 
      initial_deposit,
      // Goal tracking fields (Flexible Savings only)
      nickname,
      goal_enabled,
      goal_amount,
      goal_date,
      monthly_target,
    } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

    // Get customer's wallet
    const { data: isStaff } = await supabase.rpc('is_staff');
    let customerId: string;
    let walletId: string;

    if (isStaff) {
      if (!body.customer_id) {
        return NextResponse.json({ error: 'customer_id is required for staff' }, { status: 400 });
      }
      customerId = body.customer_id;
      const serviceClient = createServiceClient();
      const { data: wallet } = await serviceClient
        .from('wallets')
        .select('id')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .limit(1)
        .single();
      if (!wallet) return NextResponse.json({ error: 'No active wallet found for customer' }, { status: 400 });
      walletId = wallet.id;
    } else {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_id', user.id)
        .single();
      if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      customerId = customer.id;

      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .limit(1)
        .single();
      if (!wallet) return NextResponse.json({ error: 'No active wallet found' }, { status: 400 });
      walletId = wallet.id;
    }

    const account = await openAccount({
      customer_id: customerId,
      wallet_id: walletId,
      product_id,
      target_amount: goal_enabled ? (goal_amount || target_amount) : target_amount,
      initial_deposit,
      // Goal tracking
      nickname,
      goal_enabled: goal_enabled || false,
      goal_amount: goal_amount || target_amount,
      goal_date: goal_date || null,
      monthly_target: monthly_target || null,
    });

    if (initial_deposit && initial_deposit > 0) {
      try {
        const depositResult = await deposit({
          savings_account_id: account.id,
          wallet_id: walletId,
          amount: initial_deposit,
          description: 'Initial deposit',
        });
        if (!depositResult.success) {
          return NextResponse.json({
            account,
            warning: `Account opened but initial deposit failed: ${depositResult.error}`,
          }, { status: 201 });
        }
      } catch (depErr) {
        console.error('[API:savings-accounts] Initial deposit error:', depErr);
        return NextResponse.json({
          account,
          warning: 'Account opened but initial deposit failed — please deposit manually',
        }, { status: 201 });
      }
    }

    return NextResponse.json({ account }, { status: 201 });

  } catch (error) {
    console.error('[API:savings-accounts] Error:', error);
    return NextResponse.json({ error: 'An error occurred. Please try again or contact support.' }, { status: 500 });
  }
}

// GET /api/savings/accounts — list customer's savings accounts
// Enriched with balance + goal metadata (from savings_accounts columns)
export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (!isStaff) return NextResponse.json({ accounts: [] });

      const serviceClient = createServiceClient();
      const { data: accounts } = await serviceClient
        .from('savings_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      return NextResponse.json({ accounts: accounts || [] });
    }

    const accounts = await listCustomerAccounts(customer.id);

    // Deduplicate accounts by ID
    const seenAccountIds = new Set();
    const uniqueAccounts = (accounts || []).filter((acct) => {
      if (seenAccountIds.has(acct.id)) return false;
      seenAccountIds.add(acct.id);
      return true;
    });

    // Fetch goals for all accounts in one batch (now reads from savings_accounts)
    const accountIds = uniqueAccounts.map((a) => a.id);
    const goalsMap = accountIds.length > 0
      ? await getGoalsForAccounts(accountIds)
      : new Map();

    // Enrich each account with balance and goal metadata
    const enrichedAccounts = await Promise.all(
      uniqueAccounts.map(async (acct) => {
        try {
          const balance = await getSavingsBalance(acct.id);
          const goal = goalsMap.get(acct.id);
          const accountType = acct.product?.product_type || 'flexible';
          const isGoalEnabled = acct.goal_enabled || false;

          // Build goal metadata for goal-enabled accounts
          const goalData = (isGoalEnabled && goal) ? {
            name: goal.pot_name,
            target: goal.target_amount,
            progress: calculateProgress(balance, goal.target_amount),
            target_date: goal.target_date,
            monthly_target: goal.monthly_target,
            goal_status: goal.status,
          } : undefined;

          return {
            ...acct,
            interest_earned: acct.total_interest_earned || 0,
            current_balance: balance,
            available_balance: balance,
            locked_balance: 0,
            goal: goalData,
            type: isGoalEnabled ? 'goal' : accountType,
          };
        } catch {
          return {
            ...acct,
            interest_earned: acct.total_interest_earned || 0,
            current_balance: 0,
            available_balance: 0,
            locked_balance: 0,
          };
        }
      })
    );

    return NextResponse.json({ accounts: enrichedAccounts });

  } catch (error) {
    console.error('[API:savings-accounts] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
