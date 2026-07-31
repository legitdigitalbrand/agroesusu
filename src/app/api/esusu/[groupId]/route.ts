import { NextRequest, NextResponse } from 'next/server';
import { getEsusuGroup, getEsusuPayouts, getGroupMembers } from '@/modules/cooperative';
import { requireAuth } from '@/lib/auth/api-guard';

export async function GET(
  _request: NextRequest,
  context: { params: { groupId: string } }
) {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const esusuGroup = await getEsusuGroup(context.params.groupId);
    if (!esusuGroup) return NextResponse.json({ error: 'Esusu group not found' }, { status: 404 });
    const payouts = await getEsusuPayouts(context.params.groupId);
    const members = await getGroupMembers(esusuGroup.group_account_id);
    return NextResponse.json({ esusu_group: esusuGroup, payouts, members });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
