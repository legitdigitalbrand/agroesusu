import { NextRequest, NextResponse } from 'next/server';
import { listResolutions } from '@/modules/cooperative';
import { requireAuth } from '@/lib/auth/api-guard';

export async function GET(
  _request: NextRequest,
  context: { params: { coopId: string } }
) {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolutions = await listResolutions(context.params.coopId);
    return NextResponse.json({ resolutions });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
