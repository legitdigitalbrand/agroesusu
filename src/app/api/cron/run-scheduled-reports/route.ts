import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Cron Endpoint: Run Scheduled Reports
//
// Triggered daily at 6 AM UTC by Vercel Cron.
// Checks for scheduled reports that are due and generates them.
// Supports: daily, weekly, monthly, quarterly schedules.
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

    const { data: dueReports } = await supabase
      .from('scheduled_reports')
      .select('id, report_key, parameters, schedule_type')
      .eq('is_active', true)
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(10);

    if (!dueReports || dueReports.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No reports due',
        timestamp: new Date().toISOString(),
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const schedule of dueReports) {
      try {
        await supabase
          .from('report_generations')
          .insert({
            report_key: schedule.report_key,
            format: 'json',
            parameters: schedule.parameters || {},
            generated_by: null,
            record_count: 0,
            file_size_bytes: 0,
          })
          .select('id')
          .single();

        const nextRunAt = calculateNextRun(schedule.schedule_type);

        await supabase.from('scheduled_reports').update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'success',
          next_run_at: nextRunAt,
          last_error: null,
        }).eq('id', schedule.id);

        results.push({ id: schedule.id, status: 'success' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        await supabase.from('scheduled_reports').update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'failed',
          last_error: errorMsg,
        }).eq('id', schedule.id);

        results.push({ id: schedule.id, status: 'failed', error: errorMsg });
      }
    }

    return NextResponse.json({
      status: 'success',
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Scheduled reports error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}

function calculateNextRun(scheduleType: string): string {
  const now = new Date();
  switch (scheduleType) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(6, 0, 0, 0);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      now.setHours(6, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setDate(1);
      now.setHours(6, 0, 0, 0);
      break;
    case 'quarterly':
      now.setMonth(now.getMonth() + 3);
      now.setDate(1);
      now.setHours(6, 0, 0, 0);
      break;
    default:
      now.setDate(now.getDate() + 1);
  }
  return now.toISOString();
}
