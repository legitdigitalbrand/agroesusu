import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEligibility } from "@/lib/loans/eligibility";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const eligibility = await checkEligibility(user.id);
    return NextResponse.json(eligibility);
  } catch (error) {
    console.error("Eligibility check error:", error);
    return NextResponse.json({ error: "Failed to check eligibility" }, { status: 500 });
  }
}
