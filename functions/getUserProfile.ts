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

    const user = await base44.asServiceRole.entities.AppUser.get(user_id);

    if (!user) {
      return new Response(JSON.stringify({ status: "error", error: "User not found" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    const accounts = await base44.asServiceRole.entities.SavingsAccount.filter({ user_id }, undefined, 50);
    const notifications = await base44.asServiceRole.entities.Notification.filter({ user_id }, "-created_date", 5);

    return new Response(JSON.stringify({
      status: "ok",
      data: {
        user_id: user.id, email: user.email, full_name: user.full_name,
        phone: user.phone, tier: user.tier, credit_score: user.credit_score,
        kyc_status: user.kyc_status, total_saved: user.total_saved,
        total_withdrawn: user.total_withdrawn, account_status: user.account_status,
        accounts_count: accounts.length, accounts, notifications,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ status: "error", error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
