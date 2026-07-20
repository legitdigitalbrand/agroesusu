import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { attemptAutoDeduction } from "@/lib/loans/loan-operations";

/**
 * Cron: Loan Auto-Deduction
 * Runs daily to attempt auto-deduction on loans with due installments.
 * Triggered by Vercel Cron: 0 8 * * * (8 AM UTC = 9 AM WAT)
 *
 * Vercel Cron sends GET requests, so we use GET here.
 */
export async function GET(request: NextRequest) {
  // Verify cron authorization (Vercel sends AUTHORIZATION header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();

    // Find all active/overdue loans with installments due today or earlier
    const { data: loans } = await admin
      .from('loans')
      .select('id, next_due_date')
      .in('status', ['active', 'overdue'])
      .not('next_due_date', 'is', null)
      .lte('next_due_date', new Date().toISOString());

    if (!loans || loans.length === 0) {
      return NextResponse.json({ message: "No loans due for auto-deduction", processed: 0 });
    }

    let processed = 0;
    let succeeded = 0;

    for (const loan of loans) {
      const result = await attemptAutoDeduction(loan.id);
      processed++;
      if (result.success) succeeded++;
    }

    return NextResponse.json({
      message: `Auto-deduction run complete`,
      processed,
      succeeded,
    });
  } catch (error) {
    console.error("Auto-deduction cron error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// Also support POST for manual triggers
export const POST = GET;
