import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Scheduled Repayment Check
 * 
 * This endpoint should be called by Vercel Cron (or external scheduler) daily.
 * It checks for due/overdue repayment schedule items and updates their status.
 * 
 * In production with Safe Haven auto-debit enabled, it would also trigger
 * the actual debit via Safe Haven's API.
 * 
 * Vercel cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/repayments", "schedule": "0 6 * * *" }] }
 */

export async function POST(request: NextRequest) {
  // Verify authorization (Vercel cron sends a bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Find all repayment schedule items that are due today or overdue
  const { data: dueItems } = await supabase
    .from('loan_repayment_schedule')
    .select('*, loans!inner(*)')
    .lte('due_date', today)
    .in('status', ['upcoming']);

  if (!dueItems || dueItems.length === 0) {
    return NextResponse.json({ message: 'No due repayments found', processed: 0 });
  }

  let processed = 0;
  let markedOverdue = 0;

  for (const item of dueItems as any[]) {
    // Check if the loan is still active (disbursed or repaying)
    if (item.loans && (item.loans.status === 'disbursed' || item.loans.status === 'repaying')) {
      // Mark as overdue (the actual debit would happen via Safe Haven auto-debit)
      const { error } = await supabase
        .from('loan_repayment_schedule')
        .update({ status: 'overdue' })
        .eq('id', item.id);

      if (!error) {
        markedOverdue++;

        // Send notification to user
        await supabase.from('notifications').insert({
          user_id: item.loans.user_id,
          title: 'Loan Repayment Overdue',
          body: `Your repayment of ₦${item.amount_due.toLocaleString()} was due on ${item.due_date}. Please repay to avoid additional charges.`,
          read: false,
        });

        // Log loan event
        await supabase.from('loan_events').insert({
          loan_id: item.loan_id,
          event_type: 'repayment_overdue',
          payload_json: { schedule_id: item.id, amount_due: item.amount_due, due_date: item.due_date },
        });

        processed++;
      }
    }
  }

  return NextResponse.json({
    message: 'Repayment check complete',
    total_checked: dueItems.length,
    marked_overdue: markedOverdue,
    processed,
  });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'repayment-cron', schedule: 'daily 6:00 AM' });
}
