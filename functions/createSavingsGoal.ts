import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_id, name, target_amount, type, unlock_date, description, icon } = body;

    if (!user_id || !name || !target_amount || !type) {
      return new Response(JSON.stringify({
        status: "error",
        error: "Missing required fields: user_id, name, target_amount, type",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const account = await base44.asServiceRole.entities.SavingsAccount.create({
      user_id, type, name, target_amount, current_amount: 0,
      interest_rate: type === "flex" ? 2 : type === "goal" ? 5 : type === "seasonal" ? 7 : 3,
      lock_type: type === "flex" ? "none" : "until_date",
      unlock_date: unlock_date || null,
      auto_save_amount: 0, auto_save_frequency: "monthly", auto_save_enabled: false,
      status: "active", icon: icon || "🎯", description: description || "",
    });

    return new Response(JSON.stringify({ status: "ok", data: account }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: "error", error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
