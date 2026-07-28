import { NextRequest, NextResponse } from 'next/server';
import { getGroupSavingsAccount, getGroupMembers, getGroupPoolBalance, getEsusuByGroupAccount } from '@/modules/cooperative';

export async function GET(
  request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const account = await getGroupSavingsAccount(context.params.accountId);
    if (!account) return NextResponse.json({ error: 'Group savings account not found' }, { status: 404 });
    const members = await getGroupMembers(context.params.accountId);
    const poolBalance = await getGroupPoolBalance(context.params.accountId);
    const esusuGroup = await getEsusuByGroupAccount(context.params.accountId);
    return NextResponse.json({ account, members, pool_balance: poolBalance, esusu_group: esusuGroup });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
