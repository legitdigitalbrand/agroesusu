import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';

export async function GET(
  request: NextRequest,
  context: { params: { walletId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/wallets/detail', RATE_LIMITS.ADMIN);
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
    const walletId = context.params.walletId;

    const { data: wallet, error } = await serviceClient
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .maybeSingle();

    if (error || !wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    // Fetch customer
    const { data: customer } = await serviceClient
      .from('customers')
      .select('id, full_name, customer_number, email, phone, status')
      .eq('auth_id', wallet.user_id)
      .maybeSingle();

    // Fetch recent transactions
    const { data: transactions } = await serviceClient
      .from('financial_transactions')
      .select('id, transaction_reference, transaction_type, amount, status, description, initiated_at, source_module')
      .eq('wallet_id', walletId)
      .order('initiated_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      wallet,
      customer: customer || null,
      transactions: transactions || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { walletId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/wallets/action', RATE_LIMITS.ADMIN);
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
    const { action, reason, amount, transactionReference } = body;
    const walletId = context.params.walletId;

    if (!action || !reason) {
      return NextResponse.json({ error: 'Action and reason are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { data: before } = await serviceClient
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .maybeSingle();

    if (!before) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'freeze':
        updateData = { status: 'frozen' };
        break;
      case 'unfreeze':
        updateData = { status: 'active' };
        break;
      case 'adjust':
        if (!amount) return NextResponse.json({ error: 'Amount required for adjust' }, { status: 400 });
        updateData = { balance: (Number(before.balance) || 0) + Number(amount) };
        break;
      case 'reverse_transaction':
        if (!transactionReference) return NextResponse.json({ error: 'Transaction reference required' }, { status: 400 });
        // Mark the transaction as reversed via orchestrator — log for now
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (Object.keys(updateData).length > 0) {
      const { data: updated, error: updateError } = await serviceClient
        .from('wallets')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', walletId)
        .select('*')
        .single();

      if (updateError) throw new Error(updateError.message);

      await logAdminAction({
        admin_user_id: staff.id,
        admin_role: staff.role,
        action,
        action_category: 'wallet_management',
        entity_type: 'wallet',
        entity_id: walletId,
        before_state: before,
        after_state: updateData,
        metadata: { reason, amount, transactionReference },
      });

      return NextResponse.json({ success: true, wallet: updated });
    }

    await logAdminAction({
      admin_user_id: staff.id,
      admin_role: staff.role,
      action,
      action_category: 'wallet_management',
      entity_type: 'wallet',
      entity_id: walletId,
      metadata: { reason, transactionReference },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
