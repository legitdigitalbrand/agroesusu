import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { processRepayment } from "@/lib/loans/loan-operations";
import { generatePaymentReference } from "@/lib/payment-provider";
import { LOAN_REF } from "@/lib/loans/config";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { loanId, amount } = body;

    if (!loanId || !amount) {
      return NextResponse.json({ error: "Missing loanId or amount" }, { status: 400 });
    }

    // Verify the loan belongs to the user
    const admin = createAdminClient();
    const { data: loan } = await admin.from('loans').select('id, user_id, status').eq('id', loanId).eq('user_id', user.id).single();

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    if (loan.status !== 'active' && loan.status !== 'overdue') {
      return NextResponse.json({ error: "This loan is not active" }, { status: 400 });
    }

    // For manual repayment, we would normally charge via Paystack here.
    // For sandbox mode, we process the repayment directly.
    const reference = generatePaymentReference(LOAN_REF.repayment);
    const result = await processRepayment(loanId, Number(amount), 'manual', reference);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, completed: result.completed });
  } catch (error) {
    console.error("Repayment error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
