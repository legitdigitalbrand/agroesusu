import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deposit } from '@/modules/savings';

// POST /api/savings/accounts/[accountId]/deposit — deposit into savings
export async function POST(
  request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, wallet_id, description } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Verify ownership
    const { data: customer } = await supabase
      .from('customers')
      .select('id, wallets(id)')
      .eq('auth_id', user.id)
      .maybeSingle();

    const { data: isStaff } = await supabase.rpc('is_staff');

    if (!customer && !isStaff) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Use customer's wallet if not provided (or if staff specifies)
    let walletId = wallet_id;
    if (!walletId && customer) {
      const wallets = (customer as { wallets?: { id: string }[] }).wallets;
      if (wallets && wallets.length > 0) {
        walletId = wallets[0].id;
      }
    }

    if (!walletId) {
      return NextResponse.json({ error: 'wallet_id is required' }, { status: 400 });
    }

    const result = await deposit({
      savings_account_id: context.params.accountId,
      wallet_id: walletId,
      amount,
      description,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      transaction_reference: result.transaction_reference,
    });

  } catch (error) {
    console.error('[API:savings-deposit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
