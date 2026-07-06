import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { group_id, amount, reason } = await request.json();
    const requestAmount = Number(amount);

    if (!group_id || !requestAmount || requestAmount <= 0 || !reason?.trim()) {
      return NextResponse.json(
        { error: "Amount and reason are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: group } = await admin
      .from("savings_groups")
      .select("id, type, total_pool")
      .eq("id", group_id)
      .single();

    if (!group || group.type !== "emergency") {
      return NextResponse.json(
        { error: "This isn't an emergency fund group" },
        { status: 400 }
      );
    }

    const { data: membership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", group_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "You must be an active member of this group" },
        { status: 403 }
      );
    }

    if (requestAmount > Number(group.total_pool)) {
      return NextResponse.json(
        { error: "Requested amount exceeds the available pool" },
        { status: 400 }
      );
    }

    const { data: created, error: insertError } = await supabase
      .from("emergency_fund_requests")
      .insert({
        group_id,
        requester_id: user.id,
        amount: requestAmount,
        reason: reason.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ request: created });
  } catch (error: any) {
    console.error("Emergency request error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
