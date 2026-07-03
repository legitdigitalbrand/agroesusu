import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { user_id } = body;

    // Get user's savings accounts
    const accounts = await base44.entities.SavingsAccount.list({
      filter: { user_id },
      limit: 20,
    });

    // Get recent transactions
    const transactions = await base44.entities.Transaction.list({
      filter: { user_id },
      limit: 10,
      sort: "-created_date",
    });

    // Calculate totals
    const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.current_amount || 0), 0);
    const totalSaved = transactions
      .filter((t: any) => t.type === "deposit" && t.status === "completed")
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    const totalWithdrawn = transactions
      .filter((t: any) => t.type === "withdrawal" && t.status === "completed")
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

    return new Response(JSON.stringify({
      status: "ok",
      data: {
        accounts,
        transactions,
        balance: {
          totalBalance,
          totalSaved,
          totalWithdrawn,
          activeGoals: accounts.filter((a: any) => a.status === "active").length,
        },
      },
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Failed to fetch dashboard data",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
