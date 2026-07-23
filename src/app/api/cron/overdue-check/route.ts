import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Overdue Loan Status Check
 * 
 * Runs daily to mark loans as defaulted if they've been overdue for more than 30 days.
 * Vercel cron: { "path": "/api/cron/overdue-check", "schedule": "0 7 * * *" }
 */

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Find loans with overdue schedule items older than 30 days
  const { data: overdueItems } = await supabase
    .from('loan_repayment_schedule')
    .select('loan_id')
    .eq('status', 'overdue')
    .lte('due_date', thirtyDaysAgo);

  if (!overdueItems || overdueItems.length === 0) {
    return NextResponse.json({ message: 'No defaulted loans found', processed: 0 });
  }

  const defaultedLoanIds = [...new Set(overdueItems.map((i: any) => i.loan_id))];
  let processed = 0;

  for (const loanId of defaultedLoanIds) {
    // Mark loan as defaulted
    const { error } = await supabase
      .from('loans')
      .update({ status: 'defaulted' })
      .eq('id', loanId)
      .in('status', ['disbursed', 'repaying']);

    if (!error) {
      await supabase.from('loan_events').insert({
        loan_id: loanId,
        event_type: 'loan_defaulted',
        payload_json: { defaulted_at: new Date().toISOString() },
      });

      // Get the loan to find user_id for notification
      const { data: loan } = await supabase
        .from('loans')
        .select('user_id')
        .eq('id', loanId)
        .single();

      if (loan) {
        await supabase.from('notifications').insert({
          user_id: loan.user_id,
          title: 'Loan Defaulted',
          body: 'Your loan has been marked as defaulted due to non-payment. Please contact support immediately.',
          read: false,
        });
      }

      processed++;
    }
  }

  return NextResponse.json({
    message: 'Overdue check complete',
    defaulted_loans: processed,
  });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'overdue-check', schedule: 'daily 7:00 AM' });
}
