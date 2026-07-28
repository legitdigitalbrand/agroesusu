import { NextRequest, NextResponse } from 'next/server';
import { getCooperative, getExecutivePositions } from '@/modules/cooperative';

export async function GET(
  request: NextRequest,
  context: { params: { coopId: string } }
) {
  try {
    const coop = await getCooperative(context.params.coopId);
    if (!coop) return NextResponse.json({ error: 'Cooperative not found' }, { status: 404 });
    const positions = await getExecutivePositions(context.params.coopId);
    return NextResponse.json({ cooperative: coop, executive_positions: positions });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
