import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiate } from '@/modules/orchestrator';
import { dispatchNotification } from '@/modules/communications';

// POST /api/wallets/[walletId]/deposit
// Manual wallet funding (sandbox/testing mode).
// In production, wallet funding happens via Safe Haven DVA bank transfer + webhook.
//
// This endpoint is for:
// 1. Sandbox testing — simulate a bank transfer credit
// 2. Admin manual credit (with proper authorization)
// 3. Internal transfers between wallets
//
// In production, this endpoint should be restricted to admin-only or disabled.
export async function POST(
  request: NextRequest,
  context: { params: { walletId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, description, source } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Verify wallet ownership
    const { data: isStaff } = await supabase.rpc('is_staff');
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer && !isStaff) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Verify wallet belongs to customer (or staff with permission)
    if (!isStaff && customer) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('id', context.params.walletId)
        .eq('customer_id', customer.id)
        .maybeSingle();

      if (!wallet) {
        return NextResponse.json({ error: 'Forbidden: not your wallet' }, { status: 403 });
      }
    }

    // Check if this is sandbox mode (allow self-funding for testing)
    const isSandbox = process.env.SAFEHAVEN_API_URL?.includes('sandbox') || process.env.NODE_ENV !== 'production';

    if (!isSandbox && !isStaff) {
      return NextResponse.json({
        error: 'Manual wallet funding is not available in production. Use bank transfer to your DVA account.',
        hint: 'Visit /wallet/deposit to see your Safe Haven account details for bank transfer.',
      }, { status: 403 });
    }

    // Process the deposit through the Orchestrator
    const result = await initiate({
      transaction_type: 'wallet_deposit',
      source_module: 'wallet',
      source_reference: context.params.walletId,
      amount: Number(amount),
      currency: 'NGN',
      description: description || `Wallet funding (${source || 'manual'})`,
      idempotency_key: `wallet_deposit:${context.params.walletId}:${Date.now()}`,
      wallet_id: context.params.walletId,
      metadata: {
        source: source || 'manual',
        sandbox: isSandbox,
      },
    });

    if (result.status === 'failed') {
      return NextResponse.json({ error: result.error || 'Deposit failed' }, { status: 400 });
    }

    // Dispatch deposit notification (async, non-blocking)
    dispatchNotification({
      event: 'deposit_received',
      user_id: user.id,
      variables: {
        amount: Number(body.amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }),
        accountNumber: context.params.walletId.slice(0, 8),
      },
      metadata: { ft_id: result.id, transaction_reference: result.transaction_reference },
      related_entity_type: 'wallet_transaction',
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      transaction_reference: result.transaction_reference,
      amount: Number(amount),
      status: result.status,
      message: 'Wallet funded successfully',
    });

  } catch (error) {
    console.error('[API:wallet-deposit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
