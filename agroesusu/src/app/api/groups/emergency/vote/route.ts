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
    const { request_id, approve } = await request.json();

    if (!request_id || typeof approve !== "boolean") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: fundRequest } = await admin
      .from("emergency_fund_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (!fundRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (fundRequest.status !== "pending") {
      return NextResponse.json({ error: "This request has already been resolved" }, { status: 400 });
    }

    const { data: membership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", fundRequest.group_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "You must be an active member of this group" }, { status: 403 });
    }

    if (fundRequest.requester_id === user.id) {
      return NextResponse.json({ error: "You can't vote on your own request" }, { status: 400 });
    }

    // Cast the vote (session client — RLS enforces voter_id = auth.uid(), unique constraint blocks double-voting)
    const { error: voteError } = await supabase.from("emergency_fund_votes").insert({
      request_id,
      voter_id: user.id,
      approve,
    });

    if (voteError) {
      const message = voteError.code === "23505" ? "You've already voted on this request" : voteError.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Tally votes and auto-resolve at majority of active members (excluding the requester)
    const [{ count: activeMemberCount }, { data: votes }] = await Promise.all([
      admin
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", fundRequest.group_id)
        .eq("status", "active")
        .neq("user_id", fundRequest.requester_id),
      admin.from("emergency_fund_votes").select("approve").eq("request_id", request_id),
    ]);

    const eligibleVoters = activeMemberCount || 1;
    const approveCount = votes?.filter((v) => v.approve).length || 0;
    const denyCount = votes?.filter((v) => !v.approve).length || 0;
    const majorityThreshold = Math.ceil(eligibleVoters / 2);

    let resolution: "approved" | "denied" | null = null;
    if (approveCount >= majorityThreshold) resolution = "approved";
    else if (denyCount >= majorityThreshold) resolution = "denied";

    if (resolution === "approved") {
      const { data: group } = await admin
        .from("savings_groups")
        .select("total_pool")
        .eq("id", fundRequest.group_id)
        .single();

      if (group && Number(group.total_pool) >= Number(fundRequest.amount)) {
        await admin
          .from("savings_groups")
          .update({ total_pool: Number(group.total_pool) - Number(fundRequest.amount) })
          .eq("id", fundRequest.group_id);

        await admin
          .from("emergency_fund_requests")
          .update({ status: "disbursed", resolved_date: new Date().toISOString() })
          .eq("id", request_id);

        await admin.from("notifications").insert({
          user_id: fundRequest.requester_id,
          type: "emergency_fund",
          channel: "in_app",
          title: "Emergency Fund Request Approved",
          content: `Your request for ₦${Number(fundRequest.amount).toLocaleString()} was approved by the group and disbursed.`,
          status: "unread",
          metadata: { request_id },
        });
      } else {
        // Pool insufficient at resolution time — deny gracefully
        await admin
          .from("emergency_fund_requests")
          .update({ status: "denied", resolved_date: new Date().toISOString() })
          .eq("id", request_id);
      }
    } else if (resolution === "denied") {
      await admin
        .from("emergency_fund_requests")
        .update({ status: "denied", resolved_date: new Date().toISOString() })
        .eq("id", request_id);

      await admin.from("notifications").insert({
        user_id: fundRequest.requester_id,
        type: "emergency_fund",
        channel: "in_app",
        title: "Emergency Fund Request Denied",
        content: `Your request for ₦${Number(fundRequest.amount).toLocaleString()} was denied by the group.`,
        status: "unread",
        metadata: { request_id },
      });
    }

    return NextResponse.json({ status: "ok", resolution, approveCount, denyCount });
  } catch (error: any) {
    console.error("Emergency vote error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
