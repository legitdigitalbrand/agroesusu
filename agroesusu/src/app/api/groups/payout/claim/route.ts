import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPaymentService, generatePaymentReference } from "@/lib/payment-provider";
import { calcGroupPayoutFee } from "@/lib/fees";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { group_id, bank_code, account_number, account_name } = await request.json();

    if (!group_id || !bank_code || !account_number || !account_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: group } = await admin
      .from("savings_groups")
      .select("*")
      .eq("id", group_id)
      .single();

    if (!group || group.type !== "esusu") {
      return NextResponse.json({ error: "Not an esusu group" }, { status: 400 });
    }

    const { data: membership } = await admin
      .from("group_members")
      .select("*")
      .eq("group_id", group_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.slot_position !== group.current_cycle) {
      return NextResponse.json(
        { error: "You're not the current cycle's recipient" },
        { status: 403 }
      );
    }

    if (membership.has_received_payout) {
      return NextResponse.json({ error: "You've already claimed this payout" }, { status: 400 });
    }

    // Verify the cycle is actually fully funded
    const [{ count: activeMemberCount }, { data: cycleContribs }] = await Promise.all([
      admin
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", group_id)
        .eq("status", "active"),
      admin
        .from("group_contributions")
        .select("id")
        .eq("group_id", group_id)
        .eq("cycle_number", group.current_cycle)
        .eq("status", "verified"),
    ]);

    if (!activeMemberCount || !cycleContribs || cycleContribs.length < activeMemberCount) {
      return NextResponse.json(
        { error: "Not everyone has contributed for this cycle yet" },
        { status: 400 }
      );
    }

    const payoutAmount = Number(group.total_pool);
    if (payoutAmount <= 0) {
      return NextResponse.json({ error: "Nothing to pay out" }, { status: 400 });
    }

    // Facilitation fee (the automated "esusu collector" fee)
    const fee = calcGroupPayoutFee(payoutAmount);
    const netPayout = payoutAmount - fee;

    const reference = generatePaymentReference("AGC_PAY");

    // Use the payment provider abstraction
    const service = await getPaymentService();

    let recipientCode: string;
    try {
      const recipient = await service.createTransferRecipient({
        name: account_name,
        account_number,
        bank_code,
      });
      recipientCode = recipient.recipient_code;
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Could not verify bank account" }, { status: 400 });
    }

    const isLastCycle = group.current_cycle >= group.total_cycles;

    // Deduct pool + advance cycle optimistically before initiating transfer
    await admin
      .from("savings_groups")
      .update({
        total_pool: 0,
        current_cycle: group.current_cycle + 1,
        status: isLastCycle ? "completed" : group.status,
      })
      .eq("id", group_id);

    await admin
      .from("group_members")
      .update({ has_received_payout: true })
      .eq("group_id", group_id)
      .eq("user_id", user.id);

    await admin.from("transactions").insert({
      user_id: user.id,
      account_id: null,
      type: "group_payout",
      amount: netPayout,
      payment_method: "bank_transfer",
      payment_reference: reference,
      status: "processing",
      description: `Cycle ${group.current_cycle} payout from ${group.name} — ₦${fee.toLocaleString()} facilitation fee applied`,
      fee_amount: fee,
      paystack_response: JSON.stringify({ recipient_code: recipientCode, bank_code, account_number, group_id, provider: service.provider }),
    });

    try {
      const transferResult = await service.initiateTransfer({
        amount: netPayout,
        recipient_code: recipientCode,
        reference,
        reason: `AgroEsusu cycle payout — ${group.name}`,
      });

      if (transferResult.status === 'failed') {
        throw new Error('Transfer initiation failed');
      }
    } catch (err: any) {
      // Roll everything back — the transfer never even started
      await admin
        .from("savings_groups")
        .update({ total_pool: payoutAmount, current_cycle: group.current_cycle, status: group.status })
        .eq("id", group_id);
      await admin
        .from("group_members")
        .update({ has_received_payout: false })
        .eq("group_id", group_id)
        .eq("user_id", user.id);
      await admin
        .from("transactions")
        .update({ status: "reversed" })
        .eq("payment_reference", reference);

      return NextResponse.json(
        { error: err.message || "Transfer could not be initiated. Nothing has changed." },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "processing", reference, amount: netPayout, fee });
  } catch (error: any) {
    console.error("Payout claim error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
