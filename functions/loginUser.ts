import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({
        status: "error",
        error: "Email is required",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const users = await base44.asServiceRole.entities.AppUser.filter({ email }, undefined, 1);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({
        status: "error",
        error: "No account found with this email",
      }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const user = users[0];

    if (user.account_status === "suspended") {
      return new Response(JSON.stringify({
        status: "error",
        error: "This account has been suspended. Contact support.",
      }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      status: "ok",
      data: {
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        password_hash: user.password_hash,
        phone: user.phone,
        tier: user.tier,
        credit_score: user.credit_score,
        kyc_status: user.kyc_status,
        total_saved: user.total_saved,
        total_withdrawn: user.total_withdrawn,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Login failed",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
