import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_id, limit, skip } = body;

    if (!user_id) {
      return new Response(JSON.stringify({
        status: "error",
        error: "user_id is required",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const transactions = await base44.entities.Transaction.list({
      filter: { user_id },
      limit: limit || 50,
      page: Math.floor((skip || 0) / (limit || 50)),
      sort: "-created_date",
    });

    return new Response(JSON.stringify({
      status: "ok",
      data: transactions,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Failed to fetch transactions",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
