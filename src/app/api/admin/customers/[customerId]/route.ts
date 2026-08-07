import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';

export async function GET(
  request: NextRequest,
  context: { params: { customerId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/customers/detail', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const serviceClient = createServiceClient();
    const customerId = context.params.customerId;

    const { data: customer, error: custError } = await serviceClient
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();
    if (custError || !customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Fetch wallet
    const { data: wallet } = await serviceClient
      .from('wallets')
      .select('*')
      .eq('user_id', customer.auth_id)
      .maybeSingle();

    // Fetch savings accounts
    const { data: savingsAccounts } = await serviceClient
      .from('savings_accounts')
      .select('id, product_id, status, balance, interest_rate, opened_at, maturity_date, nickname, goal_enabled, goal_amount, goal_date')
      .eq('customer_id', customerId)
      .order('opened_at', { ascending: false });

    // Fetch loans
    const { data: loans } = await serviceClient
      .from('loans')
      .select('id, principal_amount, outstanding_balance, interest_rate, monthly_repayment, status, duration_months, disbursement_date, maturity_date, created_at')
      .eq('user_id', customer.auth_id)
      .order('created_at', { ascending: false });

    // Fetch recent transactions
    let recentTxs: Record<string, unknown>[] = [];
    if (wallet) {
      const { data: txs } = await serviceClient
        .from('financial_transactions')
        .select('id, transaction_reference, transaction_type, amount, status, description, initiated_at')
        .eq('wallet_id', wallet.id)
        .order('initiated_at', { ascending: false })
        .limit(10);
      recentTxs = txs || [];
    }

    // Mask BVN/NIN
    customer.bvn = customer.bvn ? `****${customer.bvn.slice(-4)}` : null;
    customer.nin = customer.nin ? `****${customer.nin.slice(-4)}` : null;

    return NextResponse.json({
      customer,
      wallet: wallet || null,
      savingsAccounts: savingsAccounts || [],
      loans: loans || [],
      recentTransactions: recentTxs,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { customerId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/customers/action', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id, role')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const body = await request.json();
    const { action, reason, notes } = body;
    const customerId = context.params.customerId;

    const serviceClient = createServiceClient();

    if (!action || !reason) {
      return NextResponse.json({ error: 'Action and reason are required' }, { status: 400 });
    }
    let updateData: Record<string, unknown> = {};
    let walletUpdate: Record<string, unknown> | null = null;

    switch (action) {
      case 'suspend':
        updateData = { status: 'suspended' };
        break;
      case 'unsuspend':
      case 'activate':
        updateData = { status: 'active' };
        break;
      case 'deactivate':
        updateData = { status: 'dormant' };
        break;
      case 'freeze_wallet':
        walletUpdate = { status: 'frozen' };
        break;
      case 'unfreeze_wallet':
        walletUpdate = { status: 'active' };
        break;
      case 'flag_fraud':
        updateData = { metadata: { fraud_flagged: true, flagged_at: new Date().toISOString() } };
        break;
      case 'whitelist':
        updateData = { metadata: { fraud_flagged: false, whitelisted: true } };
        break;
      case 'blacklist':
        updateData = { status: 'suspended', metadata: { blacklisted: true } };
        break;
      case 'reset_pin':
        updateData = { transaction_pin: null };
        break;
      case 'force_logout':
        // Force logout by invalidating sessions — log action only
        break;
      case 'add_note':
        updateData = { metadata: { staff_note: notes || reason, added_by: staff.id, added_at: new Date().toISOString() } };
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (Object.keys(updateData).length > 0) {
      // Fetch current state for audit
      const { data: before } = await serviceClient
        .from('customers')
        .select('status, metadata')
        .eq('id', customerId)
        .maybeSingle();

      const { data: updated, error: updateError } = await serviceClient
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .select('*')
        .single();

      if (updateError) throw new Error(updateError.message);

      await logAdminAction({
        admin_user_id: staff.id,
        admin_role: staff.role,
        action,
        action_category: 'customer_management',
        entity_type: 'customer',
        entity_id: customerId,
        before_state: before || undefined,
        after_state: updateData,
        metadata: { reason, notes },
      });

      // Handle wallet freeze/unfreeze
      if (walletUpdate && updated) {
        const { error: walletError } = await serviceClient
          .from('wallets')
          .update(walletUpdate)
          .eq('user_id', updated.auth_id);

        if (walletError) throw new Error(walletError.message);
      }

      return NextResponse.json({ success: true, customer: updated });
    }

    // For actions that only log (e.g., force_logout)
    await logAdminAction({
      admin_user_id: staff.id,
      admin_role: staff.role,
      action,
      action_category: 'customer_management',
      entity_type: 'customer',
      entity_id: customerId,
      metadata: { reason, notes },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
