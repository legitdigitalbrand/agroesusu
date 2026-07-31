import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { repay } from '@/modules/loans';

export async function POST(
  request: NextRequest,
  context: { params: { loanId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { amount, wallet_id } = body;

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 });

    const { data: customer } = await supabase.from('customers').select('id, wallets(id)').eq('auth_id', user.id).maybeSingle();
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!customer && !isStaff) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // CRITICAL: Verify the loan belongs to this customer (or staff)
    if (!isStaff && customer) {
      const { data: loan } = await supabase
        .from('loans')
        .select('customer_id')
        .eq('id', context.params.loanId)
        .maybeSingle();

      if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      if (loan.customer_id !== customer.id) return NextResponse.json({ error: 'Forbidden: not your loan' }, { status: 403 });
    }

    let walletId = wallet_id;
    if (!walletId && customer) {
      const wallets = (customer as { wallets?: { id: string }[] }).wallets;
      if (wallets && wallets.length > 0) walletId = wallets[0].id;
    }
    if (!walletId) return NextResponse.json({ error: 'wallet_id required' }, { status: 400 });

    const result = await repay({
      loan_id: context.params.loanId,
      wallet_id: walletId,
      amount: Number(amount),
    });

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API:loan-repay] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
