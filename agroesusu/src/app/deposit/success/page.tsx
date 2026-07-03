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
          // The webhook should handle this, but this is a fallback
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Check if transaction is still pending
            const { data: tx } = await supabase
              .from("transactions")
              .select("status, account_id, amount")
              .eq("payment_reference", reference)
              .single();

            if (tx && tx.status === "pending") {
              // Credit account
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

              // Update transaction status
              await supabase
                .from("transactions")
                .update({ status: "completed", completed_date: new Date().toISOString() })
                .eq("payment_reference", reference);

              // Update profile
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
        <Loader2 className="w-10 h-10 text-brand-green animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-stone-700">
          Verifying your deposit...
        </p>
        <p className="text-xs text-stone-400 mt-1">Please don't close this page</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-semibold text-stone-900">
          Verification Failed
        </h1>
        <p className="text-sm text-stone-500 mt-2">
          We couldn't verify your payment. If you were charged, your money is
          safe — contact support with reference: {reference}
        </p>
        <Link
          href="/"
          className="block w-full bg-stone-100 text-stone-700 rounded-xl py-3.5 font-semibold text-sm mt-6 hover:bg-stone-200"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-brand-lime/20 flex items-center justify-center mx-auto mb-5">
        <Check className="w-8 h-8 text-brand-green" strokeWidth={2.5} />
      </div>
      <h1 className="text-xl font-semibold text-stone-900">
        Deposit Successful
      </h1>
      <p className="text-sm text-stone-500 mt-2">
        ₦{details.amount?.toLocaleString()} has been added to your savings
      </p>

      <div className="bg-stone-50 rounded-xl p-4 mt-6 text-left">
        <div className="flex justify-between text-sm py-1.5">
          <span className="text-stone-500">Amount</span>
          <span className="font-medium tabular-nums">
            ₦{details.amount?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm py-1.5">
          <span className="text-stone-500">Fee</span>
          <span className="font-medium">₦0</span>
        </div>
        <div className="flex justify-between text-sm py-1.5 border-t border-brand-border mt-1.5 pt-2.5">
          <span className="text-stone-500">Reference</span>
          <span className="font-mono text-xs text-stone-600">
            {details.reference}
          </span>
        </div>
      </div>

      <Link
        href="/"
        className="block w-full bg-brand-green text-white rounded-xl py-3.5 font-semibold text-sm mt-6 hover:bg-brand-green/90 transition-colors"
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
          <Loader2 className="w-10 h-10 text-brand-green animate-spin mx-auto mb-4" />
          <p className="text-sm text-stone-500">Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
