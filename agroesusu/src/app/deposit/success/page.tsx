"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckIcon, AlertTriangleIcon } from "@/components/icons";
import { Suspense, useEffect, useState, useRef } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [status, setStatus] = useState<"verifying" | "success" | "failed" | "processing">("verifying");
  const [details, setDetails] = useState<{ amount?: number; reference?: string }>({});
  const pollCount = useRef(0);

  useEffect(() => {
    if (!reference) {
      setStatus("failed");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/paystack/verify?reference=${reference}`);
        const data = await res.json();
        pollCount.current++;

        if (data.status === "success") {
          setDetails({ amount: data.amount, reference: data.reference });
          setStatus("success");
        } else if (pollCount.current >= 10) {
          // After ~30 seconds of polling, show "processing" instead of "failed"
          // The webhook will still credit the account when it arrives
          setStatus("processing");
        } else {
          // Wait 3 seconds and retry
          setTimeout(verify, 3000);
        }
      } catch {
        if (pollCount.current >= 10) {
          setStatus("processing");
        } else {
          setTimeout(verify, 3000);
        }
      }
    }

    verify();
  }, [reference]);

  if (status === "verifying") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Verifying your deposit...</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Please don&apos;t close this page</p>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--accent-subtle)" }}>
          <CheckIcon className="w-7 h-7" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Payment Received</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          We&apos;ve received your payment and are processing it. Your savings will be credited shortly.
        </p>
        <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
          Reference: {reference}
        </p>
        <Link href="/" className="block w-full rounded-xl py-3.5 font-semibold text-sm mt-6 transition"
          style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(255,77,109,0.1)" }}>
          <AlertTriangleIcon className="w-7 h-7" style={{ color: "var(--danger)" }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Verification Failed</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          We couldn&apos;t verify your payment. If you were charged, your money is safe — contact support with reference: {reference}
        </p>
        <Link href="/" className="block w-full rounded-xl py-3.5 font-semibold text-sm mt-6 border"
          style={{ background: "var(--surface-card)", color: "var(--text-secondary)", borderColor: "var(--border-default)" }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ background: "var(--accent-subtle)" }}>
        <CheckIcon className="w-8 h-8" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
      </div>
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Deposit Successful</h1>
      <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
        ₦{details.amount?.toLocaleString()} has been added to your savings
      </p>

      <div className="rounded-xl p-4 mt-6 text-left border"
        style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <div className="flex justify-between text-sm py-1.5">
          <span style={{ color: "var(--text-muted)" }}>Amount</span>
          <span className="font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
            ₦{details.amount?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm py-1.5">
          <span style={{ color: "var(--text-muted)" }}>Fee</span>
          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>₦0</span>
        </div>
        <div className="flex justify-between text-sm py-1.5 border-t mt-1.5 pt-2.5"
          style={{ borderColor: "var(--border-subtle)" }}>
          <span style={{ color: "var(--text-muted)" }}>Reference</span>
          <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{details.reference}</span>
        </div>
      </div>

      <Link href="/" className="block w-full rounded-xl py-3.5 font-semibold text-sm mt-6 transition"
        style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
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
          <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
