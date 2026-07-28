import { NextRequest, NextResponse } from 'next/server';
import { reconcileAllWallets } from '@/modules/wallet';

// ============================================================================
// Cron Endpoint: Reconciliation
// 
// Triggered daily at 2 AM by Vercel Cron.
// Compares our recorded wallet balances against Safe Haven's actual balances.
// Discrepancies are flagged in reconciliation_flags — NEVER auto-corrected.
//
// Authentication: CRON_SECRET header
// ============================================================================

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await reconcileAllWallets();
    
    const matched = results.filter(r => r.status === 'matched').length;
    const discrepancies = results.filter(r => r.status === 'discrepancy').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`[Cron:reconcile] Total=${results.length} Matched=${matched} Discrepancies=${discrepancies} Errors=${errors}`);
    
    return NextResponse.json({
      status: 'complete',
      total_wallets: results.length,
      matched,
      discrepancies,
      errors,
      results: results.map(r => ({
        wallet_id: r.wallet_id,
        status: r.status,
        discrepancy: r.discrepancy,
        flag_id: r.flag_id,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron:reconcile] Error:', error);
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
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await reconcileAllWallets();
    
    return NextResponse.json({
      status: 'complete',
      total_wallets: results.length,
      matched: results.filter(r => r.status === 'matched').length,
      discrepancies: results.filter(r => r.status === 'discrepancy').length,
      errors: results.filter(r => r.status === 'error').length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
