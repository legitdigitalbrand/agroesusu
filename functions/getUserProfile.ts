import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({
        status: "error",
        error: "user_id is required",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Get user from AppUser entity
    const user = await base44.entities.AppUser.get(user_id);

    if (!user) {
      return new Response(JSON.stringify({
        status: "error",
        error: "User not found",
      }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    // Get accounts
    const accounts = await base44.entities.SavingsAccount.list({
      filter: { user_id },
      limit: 50,
    });

    // Get notifications
    const notifications = await base44.entities.Notification.list({
      filter: { user_id },
      limit: 5,
      sort: "-created_date",
    });

    return new Response(JSON.stringify({
      status: "ok",
      data: {
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        tier: user.tier,
        credit_score: user.credit_score,
        kyc_status: user.kyc_status,
        total_saved: user.total_saved,
        total_withdrawn: user.total_withdrawn,
        account_status: user.account_status,
        accounts_count: accounts.length,
        accounts,
        notifications,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Failed to fetch profile",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
