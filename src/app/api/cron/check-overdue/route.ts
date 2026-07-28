import { NextRequest, NextResponse } from 'next/server';
import { runCollectionsCheck } from '@/modules/loans';

// POST /api/cron/check-overdue — daily collections check (6 AM)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runCollectionsCheck();
    return NextResponse.json({
      status: 'completed',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron:check-overdue] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
