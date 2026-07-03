import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { group_id, user_id, invited_by } = body;

    if (!group_id || !user_id) {
      return new Response(JSON.stringify({ status: "error", error: "Missing required fields: group_id, user_id" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const group = await base44.asServiceRole.entities.SavingsGroup.get(group_id);
    if (!group) {
      return new Response(JSON.stringify({ status: "error", error: "Group not found" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    if (group.member_count >= group.max_members) {
      return new Response(JSON.stringify({ status: "error", error: "This group is full" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const existing = await base44.asServiceRole.entities.GroupMember.filter({ group_id, user_id }, undefined, 1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ status: "error", error: "Already a member" }), {
        status: 409, headers: { "Content-Type": "application/json" },
      });
    }

    const member = await base44.asServiceRole.entities.GroupMember.create({
      group_id, user_id, slot_position: group.member_count + 1, status: "active",
      reliability_rating: 100, has_received_payout: false,
      joined_date: new Date().toISOString(), invited_by: invited_by || group.admin_id,
    });

    await base44.asServiceRole.entities.SavingsGroup.update(group_id, {
      member_count: group.member_count + 1,
      status: group.member_count + 1 >= group.max_members ? "active" : group.status,
    });

    return new Response(JSON.stringify({ status: "ok", data: member }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: "error", error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
