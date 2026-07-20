import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLoanApplication } from "@/lib/loans/loan-operations";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { amount, numInstallments, linkedPotId, esusuPayoutOptIn, linkedGroupId, disbursementAccountId, disbursementBankCode, disbursementAccountNumber, disbursementAccountName } = body;

    if (!amount || !numInstallments || !linkedPotId || !disbursementAccountId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await createLoanApplication({
      userId: user.id,
      amount: Number(amount),
      numInstallments: Number(numInstallments),
      linkedPotId,
      esusuPayoutOptIn: Boolean(esusuPayoutOptIn),
      linkedGroupId,
      disbursementAccountId,
      disbursementBankCode,
      disbursementAccountNumber,
      disbursementAccountName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, loanId: result.loanId });
  } catch (error) {
    console.error("Loan application error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
