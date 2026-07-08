"use client";

import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { CheckIcon, AlertTriangleIcon } from "@/components/icons";
import { formatNaira } from "@/lib/utils";
import { Suspense, useEffect, useState, useRef } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const groupId = params.id as string;
  const reference = searchParams.get("reference");
  const [status, setStatus] = useState<"verifying" | "success" | "failed" | "processing">("verifying");
  const [amount, setAmount] = useState<number | undefined>();
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
          setAmount(data.amount);
          setStatus("success");
        } else if (pollCount.current >= 10) {
          setStatus("processing");
        } else {
          setTimeout(verify, 3000);
        }
      } catch {
        if (pollCount.current >= 10) setStatus("processing");
        else setTimeout(verify, 3000);
      }
    }

    verify();
  }, [reference]);

  const backLink = `/groups/${groupId}`;

  if (status === "verifying") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Verifying your contribution...</p>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-subtle)" }}>
          <CheckIcon className="w-7 h-7" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Payment Received</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>We&apos;re processing your contribution — it&apos;ll reflect in the group pool shortly.</p>
        <Link href={backLink} className="block w-full rounded-xl py-3.5 font-semibold text-sm mt-6 transition" style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
          Back to Group
        </Link>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(255,77,109,0.1)" }}>
          <AlertTriangleIcon className="w-7 h-7" style={{ color: "var(--danger)" }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Verification Failed</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          If you were charged, your money is safe — contact support with reference: {reference}
        </p>
        <Link href={backLink} className="block w-full rounded-xl py-3.5 font-semibold text-sm mt-6 border" style={{ background: "var(--surface-card)", color: "var(--text-secondary)", borderColor: "var(--border-default)" }}>
          Back to Group
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "var(--accent-subtle)" }}>
        <CheckIcon className="w-8 h-8" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
      </div>
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Contribution Successful</h1>
      <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{formatNaira(Number(amount || 0))} added to the group pool</p>
      <Link href={backLink} className="block w-full rounded-xl py-3.5 font-semibold text-sm mt-6 transition" style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
        Back to Group
      </Link>
    </div>
  );
}

export default function ContributeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
