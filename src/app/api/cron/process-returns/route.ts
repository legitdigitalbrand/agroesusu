import { NextRequest, NextResponse } from 'next/server';
import { batchProcessReturns, processMaturities } from '@/modules/investments';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const returnsResult = await batchProcessReturns();
    const maturityResult = await processMaturities();

    return NextResponse.json({
      returns: returnsResult,
      maturities: maturityResult,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
