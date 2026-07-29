import { NextRequest, NextResponse } from 'next/server';
import { listResolutions } from '@/modules/cooperative';

export async function GET(
  _request: NextRequest,
  context: { params: { coopId: string } }
) {
  try {
    const resolutions = await listResolutions(context.params.coopId);
    return NextResponse.json({ resolutions });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
