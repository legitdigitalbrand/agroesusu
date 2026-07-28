import { NextRequest, NextResponse } from 'next/server';
import { listMeetings } from '@/modules/cooperative';

export async function GET(
  request: NextRequest,
  context: { params: { coopId: string } }
) {
  try {
    const meetings = await listMeetings(context.params.coopId);
    return NextResponse.json({ meetings });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
