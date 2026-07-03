import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { email, password_hash, full_name, phone } = body;

    if (!email || !password_hash || !full_name) {
      return new Response(JSON.stringify({
        status: "error",
        error: "Missing required fields: email, password_hash, full_name",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Check if user already exists
    const existing = await base44.entities.AppUser.list({
      filter: { email },
      limit: 1,
    });

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({
        status: "error",
        error: "An account with this email already exists",
      }), { status: 409, headers: { "Content-Type": "application/json" } });
    }

    // Create the user
    const user = await base44.entities.AppUser.create({
      email,
      full_name,
      password_hash,
      phone: phone || "",
      kyc_status: "pending",
      credit_score: 300,
      tier: "basic",
      account_status: "active",
      total_saved: 0,
      total_withdrawn: 0,
    });

    return new Response(JSON.stringify({
      status: "ok",
      data: {
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Registration failed",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
