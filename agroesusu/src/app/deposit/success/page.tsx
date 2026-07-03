"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [status, setStatus] = useState<"verifying" | "success" | "failed">(
    "verifying"
  );
  const [details, setDetails] = useState<{
    amount?: number;
    reference?: string;
  }>({});

  useEffect(() => {
    if (!reference) {
      setStatus("failed");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/paystack/verify?reference=${reference}`);
        const data = await res.json();

        if (data.status === "success") {
          setDetails({ amount: data.amount, reference: data.reference });
          setStatus("success");

          // Credit the account client-side as backup to webhook
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: tx } = await supabase
              .from("transactions")
              .select("status, account_id, amount")
              .eq("payment_reference", reference)
              .single();

            if (tx && tx.status === "pending") {
              const { data: account } = await supabase
                .from("savings_accounts")
                .select("current_amount")
                .eq("id", tx.account_id)
                .single();

              if (account) {
                const newBalance = Number(account.current_amount) + Number(tx.amount);
                await supabase
                  .from("savings_accounts")
                  .update({ current_amount: newBalance })
                  .eq("id", tx.account_id);
              }

              await supabase
                .from("transactions")
                .update({ status: "completed", completed_date: new Date().toISOString() })
                .eq("payment_reference", reference);

              const { data: profile } = await supabase
                .from("profiles")
                .select("total_saved")
                .eq("id", user.id)
                .single();

              if (profile) {
                await supabase
                  .from("profiles")
                  .update({ total_saved: Number(profile.total_saved) + Number(tx.amount) })
                  .eq("id", user.id);
              }
            }
          }
        } else {
          setStatus("failed");
        }
      } catch {
        setStatus("failed");
      }
    }

    verify();
  }, [reference]);

  if (status === "verifying") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-brand-200">
          Verifying your deposit...
        </p>
        <p className="text-xs text-brand-300/40 mt-1">Please don't close this page</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-semibold text-brand-50">
          Verification Failed
        </h1>
        <p className="text-sm text-brand-300/60 mt-2">
          We couldn't verify your payment. If you were charged, your money is
          safe — contact support with reference: {reference}
        </p>
        <Link
          href="/"
          className="block w-full bg-brand-900 text-brand-200 rounded-xl py-3.5 font-semibold text-sm mt-6 hover:bg-brand-800 border border-brand-500/15"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-brand-500/15 flex items-center justify-center mx-auto mb-5">
        <Check className="w-8 h-8 text-brand-400" strokeWidth={2.5} />
      </div>
      <h1 className="text-xl font-semibold text-brand-50">
        Deposit Successful
      </h1>
      <p className="text-sm text-brand-300/60 mt-2">
        ₦{details.amount?.toLocaleString()} has been added to your savings
      </p>

      <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-4 mt-6 text-left">
        <div className="flex justify-between text-sm py-1.5">
          <span className="text-brand-300/50">Amount</span>
          <span className="font-medium tabular-nums text-brand-100">
            ₦{details.amount?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm py-1.5">
          <span className="text-brand-300/50">Fee</span>
          <span className="font-medium text-brand-100">₦0</span>
        </div>
        <div className="flex justify-between text-sm py-1.5 border-t border-brand-500/10 mt-1.5 pt-2.5">
          <span className="text-brand-300/50">Reference</span>
          <span className="font-mono text-xs text-brand-200">
            {details.reference}
          </span>
        </div>
      </div>

      <Link
        href="/"
        className="block w-full bg-brand-500 text-brand-950 rounded-xl py-3.5 font-semibold text-sm mt-6 hover:bg-brand-400 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

export default function DepositSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-brand-300/60">Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
