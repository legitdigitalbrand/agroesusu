import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ status: "error", error: "user_id is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const memberships = await base44.asServiceRole.entities.GroupMember.filter({ user_id }, undefined, 50);
    const groupIds = memberships.map((m: any) => m.group_id);

    if (groupIds.length === 0) {
      return new Response(JSON.stringify({ status: "ok", data: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const groups = [];
    for (const groupId of groupIds) {
      try {
        const group = await base44.asServiceRole.entities.SavingsGroup.get(groupId);
        const membership = memberships.find((m: any) => m.group_id === groupId);
        groups.push({
          ...group, member_slot: membership?.slot_position,
          member_status: membership?.status, has_received_payout: membership?.has_received_payout,
        });
      } catch (e) {}
    }

    return new Response(JSON.stringify({ status: "ok", data: groups }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: "error", error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
