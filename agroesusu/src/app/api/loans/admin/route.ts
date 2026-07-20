import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { disburseLoan } from "@/lib/loans/loan-operations";

// Admin endpoint to approve and disburse a loan
export async function POST(request: NextRequest) {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Check if user is admin (add admin role check)
  // For now, we check if the user's tier is 'admin' or has an admin flag
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('tier').eq('id', user.id).single();

  if (profile?.tier !== 'admin') {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { loanId, action } = body;

    if (action === 'approve') {
      const result = await disburseLoan(loanId, user.id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'reject') {
      const { reason } = body;
      await admin.from('loans').update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_date: new Date().toISOString(),
        admin_notes: reason || 'Rejected by admin',
      }).eq('id', loanId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin loan action error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// GET: Admin dashboard data
export async function GET(request: NextRequest) {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('tier').eq('id', user.id).single();

  if (profile?.tier !== 'admin') {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [
    { data: activeLoans },
    { data: overdueLoans },
    { data: pendingLoans },
    { data: completedLoans },
  ] = await Promise.all([
    admin.from('loans').select('*').in('status', ['active']),
    admin.from('loans').select('*').in('status', ['overdue']),
    admin.from('loans').select('*').eq('status', 'pending_review'),
    admin.from('loans').select('*').eq('status', 'completed'),
  ]);

  const totalDisbursed = (activeLoans || []).concat(overdueLoans || []).reduce((sum, l) => sum + Number(l.principal), 0);
  const totalOutstanding = (activeLoans || []).concat(overdueLoans || []).reduce((sum, l) => sum + Number(l.outstanding_balance), 0);

  // Overdue by day-count bucket
  const overdueBuckets = {
    grace: (overdueLoans || []).filter(l => l.overdue_days <= 3).length,
    restricted: (overdueLoans || []).filter(l => l.overdue_days > 3 && l.overdue_days < 14).length,
    manualReview: (overdueLoans || []).filter(l => l.overdue_days >= 14).length,
  };

  return NextResponse.json({
    active: activeLoans || [],
    overdue: overdueLoans || [],
    pending: pendingLoans || [],
    completed: completedLoans || [],
    summary: {
      totalDisbursed,
      totalOutstanding,
      activeCount: (activeLoans || []).length,
      overdueCount: (overdueLoans || []).length,
      pendingCount: (pendingLoans || []).length,
      completedCount: (completedLoans || []).length,
      overdueBuckets,
    },
  });
}
