import { NextRequest, NextResponse } from 'next/server';
import { accrueInterestForAllAccounts } from '@/modules/savings';

// POST /api/cron/accrue-interest — daily interest accrual cron job
// Protected by CRON_SECRET header
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await accrueInterestForAllAccounts();

    return NextResponse.json({
      status: 'completed',
      ...result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Cron:accrue-interest] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
