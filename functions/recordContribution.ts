import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { group_id, user_id, cycle_number, amount, payment_reference } = body;

    if (!group_id || !user_id || !cycle_number || !amount) {
      return new Response(JSON.stringify({
        status: "error",
        error: "Missing required fields: group_id, user_id, cycle_number, amount",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Check if already contributed for this cycle
    const existing = await base44.entities.GroupContribution.list({
      filter: { group_id, user_id, cycle_number },
      limit: 1,
    });

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({
        status: "error",
        error: "You have already contributed for this cycle",
      }), { status: 409, headers: { "Content-Type": "application/json" } });
    }

    const contribution = await base44.entities.GroupContribution.create({
      group_id,
      user_id,
      cycle_number,
      amount,
      payment_reference: payment_reference || `GRP_${Date.now()}`,
      status: "pending",
      paid_date: new Date().toISOString(),
      notes: "",
    });

    return new Response(JSON.stringify({
      status: "ok",
      data: contribution,
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Failed to record contribution",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
