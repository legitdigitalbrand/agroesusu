import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { 
      name, admin_id, type, contribution_amount, frequency, 
      max_members, total_cycles, description 
    } = body;

    if (!name || !admin_id || !contribution_amount || !frequency) {
      return new Response(JSON.stringify({
        status: "error",
        error: "Missing required fields: name, admin_id, contribution_amount, frequency",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Create the group
    const group = await base44.entities.SavingsGroup.create({
      name,
      admin_id,
      type: type || "esusu",
      contribution_amount,
      frequency,
      member_count: 1,
      max_members: max_members || 10,
      payout_method: "rotation",
      current_cycle: 1,
      total_cycles: total_cycles || max_members || 10,
      start_date: new Date().toISOString(),
      end_date: null,
      status: "recruiting",
      description: description || "",
      total_pool: 0,
    });

    // Add admin as first member (slot 1)
    await base44.entities.GroupMember.create({
      group_id: group.id,
      user_id: admin_id,
      slot_position: 1,
      status: "active",
      reliability_rating: 100,
      has_received_payout: false,
      joined_date: new Date().toISOString(),
      invited_by: admin_id,
    });

    return new Response(JSON.stringify({
      status: "ok",
      data: group,
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Failed to create group",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
