import { NextResponse } from "next/server";
import { getPaymentService } from "@/lib/payment-provider";
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
    const service = await getPaymentService();
    const banks = await service.listBanks();
    return NextResponse.json({ banks, provider: service.provider });
  } catch (error: any) {
    console.error("List banks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch banks" },
      { status: 500 }
    );
  }
}
