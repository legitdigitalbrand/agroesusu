import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileWithdrawal } from '@/modules/withdrawal';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
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
        const result = await reconcileWithdrawal(withdrawal.id);
        if (result.status === 'completed') completed++;
        else if (result.status === 'failed') failed++;
        else if (result.status === 'pending') stillPending++;
        else errors++;
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Cron] Reconciliation failed for ${withdrawal.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      status: 'success',
      total: pendingWithdrawals.length,
      completed, failed, stillPending, errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Reconcile withdrawals error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
