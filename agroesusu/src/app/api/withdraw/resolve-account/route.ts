import { NextRequest, NextResponse } from "next/server";
import { resolveAccountNumber } from "@/lib/paystack";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { account_number, bank_code } = await request.json();

    if (!account_number || !bank_code) {
      return NextResponse.json(
        { error: "Account number and bank are required" },
        { status: 400 }
      );
    }

    const resolved = await resolveAccountNumber(account_number, bank_code);
    return NextResponse.json(resolved);
  } catch (error: any) {
    console.error("Resolve account error:", error);
    return NextResponse.json(
      { error: error.message || "Could not resolve account number" },
      { status: 400 }
    );
  }
}
