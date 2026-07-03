import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { group_id } = body;

    if (!group_id) {
      return new Response(JSON.stringify({
        status: "error",
        error: "group_id is required",
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Get group
    const group = await base44.entities.SavingsGroup.get(group_id);

    if (!group) {
      return new Response(JSON.stringify({
        status: "error",
        error: "Group not found",
      }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    // Get members
    const members = await base44.entities.GroupMember.list({
      filter: { group_id },
      limit: 50,
      sort: "slot_position",
    });

    // Get contributions
    const contributions = await base44.entities.GroupContribution.list({
      filter: { group_id },
      limit: 100,
      sort: "-created_date",
    });

    // Calculate stats
    const totalContributed = contributions
      .filter((c: any) => c.status === "verified")
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

    const currentCycleContributions = contributions.filter(
      (c: any) => c.cycle_number === group.current_cycle && c.status === "verified"
    );

    return new Response(JSON.stringify({
      status: "ok",
      data: {
        ...group,
        members,
        contributions,
        stats: {
          totalContributed,
          currentCyclePaid: currentCycleContributions.length,
          currentCycleTotal: group.member_count,
          progressPercentage: Math.round((currentCycleContributions.length / group.member_count) * 100),
        },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      error: error.message || "Failed to fetch group details",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
