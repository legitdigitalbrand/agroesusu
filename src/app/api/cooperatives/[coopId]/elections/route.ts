import { NextRequest, NextResponse } from 'next/server';
import { listElections } from '@/modules/cooperative';

export async function GET(
  request: NextRequest,
  context: { params: { coopId: string } }
) {
  try {
    const elections = await listElections(context.params.coopId);
    return NextResponse.json({ elections });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
