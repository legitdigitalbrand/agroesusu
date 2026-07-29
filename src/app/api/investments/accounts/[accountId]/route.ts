import { NextRequest, NextResponse } from 'next/server';
import { getInvestmentAccount, getAccountTransactions } from '@/modules/investments';

export async function GET(
  _request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const account = await getInvestmentAccount(context.params.accountId);
    if (!account) return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
    const transactions = await getAccountTransactions(context.params.accountId);
    return NextResponse.json({ account, transactions });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
