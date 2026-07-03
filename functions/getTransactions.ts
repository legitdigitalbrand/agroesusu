import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_id, limit, skip } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ status: "error", error: "user_id is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { user_id }, "-created_date", limit || 50, skip || 0
    );

    return new Response(JSON.stringify({ status: "ok", data: transactions }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: "error", error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
