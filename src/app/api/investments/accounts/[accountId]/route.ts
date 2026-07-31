import { NextRequest, NextResponse } from 'next/server';
import { getInvestmentAccount, getAccountTransactions } from '@/modules/investments';
import { requireAuth, verifyOwnership } from '@/lib/auth/api-guard';

export async function GET(
  _request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const { user, customerId, isStaff, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify ownership
    const owns = await verifyOwnership(supabase, customerId, isStaff, 'investment_accounts', context.params.accountId);
    if (!owns) return NextResponse.json({ error: 'Forbidden: not your account' }, { status: 403 });

    const account = await getInvestmentAccount(context.params.accountId);
    if (!account) return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
    const transactions = await getAccountTransactions(context.params.accountId);
    return NextResponse.json({ account, transactions });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
