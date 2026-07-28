import { NextRequest, NextResponse } from 'next/server';
import { processEventBatch } from '@/modules/wallet';

// ============================================================================
// Cron Endpoint: Process Inbound Events
// 
// Triggered every 5 minutes by Vercel Cron.
// Picks up received events from inbound_events and processes them into
// wallet_transactions + balance cache updates.
//
// Authentication: CRON_SECRET header (Vercel Cron automatically sends this)
// ============================================================================

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processEventBatch(50);
    
    console.log(`[Cron:process-events] Processed=${result.processed} Failed=${result.failed} Skipped=${result.skipped}`);
    
    return NextResponse.json({
      status: 'complete',
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron:process-events] Error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET for manual trigger / health check
export async function GET(request: NextRequest) {
  // Manual trigger — check for CRON_SECRET or staff auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processEventBatch(50);
    
    return NextResponse.json({
      status: 'complete',
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
