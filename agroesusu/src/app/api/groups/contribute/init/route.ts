import { NextRequest, NextResponse } from "next/server";
import { getPaymentService, generatePaymentReference } from "@/lib/payment-provider";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "group_contribute_init", {
    maxAttempts: 8,
    windowSeconds: 600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  try {
    const { group_id, email } = await request.json();

    if (!group_id || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: group } = await admin
      .from("savings_groups")
      .select("*")
      .eq("id", group_id)
      .single();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.status !== "active" && group.status !== "recruiting") {
      return NextResponse.json({ error: "This group is no longer accepting contributions" }, { status: 400 });
    }

    const { data: membership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", group_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "You must be an active member of this group" }, { status: 403 });
    }

    // Esusu groups: one contribution per member per cycle
    const cycleNumber = group.type === "esusu" ? group.current_cycle : 0;

    if (group.type === "esusu") {
      const { data: existing } = await admin
        .from("group_contributions")
        .select("id, status")
        .eq("group_id", group_id)
        .eq("user_id", user.id)
        .eq("cycle_number", cycleNumber)
        .maybeSingle();

      if (existing && existing.status !== "rejected") {
        return NextResponse.json(
          { error: "You've already contributed for this cycle" },
          { status: 400 }
        );
      }
    }

    const reference = generatePaymentReference("AGC_GRP");
    const origin = request.nextUrl.origin;

    const { error: insertError } = await supabase.from("group_contributions").insert({
      group_id,
      user_id: user.id,
      cycle_number: cycleNumber,
      amount: Number(group.contribution_amount),
      payment_reference: reference,
      status: "pending",
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const service = await getPaymentService();
    const response = await service.initializeTransaction({
      email,
      amount: Number(group.contribution_amount),
      reference,
      callback_url: `${origin}/groups/${group_id}/contribute-success?reference=${reference}`,
      metadata: {
        user_id: user.id,
        group_id,
        cycle_number: cycleNumber,
      },
    });

    if (!response.authorization_url) {
      return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });
    }

    return NextResponse.json({
      authorization_url: response.authorization_url,
      reference: response.reference,
    });
  } catch (error: any) {
    console.error("Group contribute init error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
