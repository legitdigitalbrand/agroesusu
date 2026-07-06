import { NextResponse } from "next/server";
import { listBanks } from "@/lib/paystack";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const banks = await listBanks();
    return NextResponse.json({ banks });
  } catch (error: any) {
    console.error("List banks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch banks" },
      { status: 500 }
    );
  }
}
