import { NextRequest, NextResponse } from "next/server";
import { processOverdueLoans } from "@/lib/loans/loan-operations";

/**
 * Cron: Loan Overdue Escalation
 * Runs daily to check for overdue installments and apply graduated escalation.
 * Triggered by Vercel Cron: 0 9 * * * (9 AM UTC = 10 AM WAT)
 *
 * Vercel Cron sends GET requests, so we use GET here.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processOverdueLoans();
    return NextResponse.json({
      message: "Overdue escalation complete",
      processed: result.processed,
    });
  } catch (error) {
    console.error("Overdue escalation cron error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// Also support POST for manual triggers
export const POST = GET;
