import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileWithdrawal } from '@/modules/withdrawal';

// ============================================================================
// Cron Endpoint: Reconcile Pending Withdrawals
//
// Triggered daily at noon UTC by Vercel Cron.
// On Vercel Pro plan, this should run every 15 minutes.
// Checks pending withdrawal_requests against Safe Haven transfer status
// and settles or reverses them.
//
// Authentication: CRON_SECRET header
// ============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();

    const { data: pendingWithdrawals } = await supabase
      .from('withdrawal_requests')
      .select('id, payment_reference, amount, customer_id, wallet_id')
      .in('status', ['pending', 'transfer_submitted', 'requires_reconciliation'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (!pendingWithdrawals || pendingWithdrawals.length === 0) {
      return NextResponse.json({ status: 'success', reconciled: 0, timestamp: new Date().toISOString() });
    }

    let completed = 0, failed = 0, stillPending = 0, errors = 0;

    for (const withdrawal of pendingWithdrawals) {
      try {
        const result = await reconcileWithdrawal(withdrawal.payment_reference);
        if (result.status === 'completed') {
          completed++;
        } else if (result.status === 'failed') {
          failed++;
        } else {
          stillPending++;
        }
      } catch (err) {
        console.error(`Reconciliation error for withdrawal ${withdrawal.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      status: 'success',
      processed: pendingWithdrawals.length,
      completed,
      failed,
      stillPending,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reconcile withdrawals cron error:', error);
    return NextResponse.json(
      { error: 'Reconciliation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
