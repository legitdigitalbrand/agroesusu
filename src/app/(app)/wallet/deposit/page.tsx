"use client";

import { useMe } from "@/hooks/use-me";
import { LoadingState } from "@/components/yield";
import { Copy, ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// ════════════════════════════════════════════════════════════
// Wallet Deposit — shows the DVA account number so users
// can fund their wallet via bank transfer
// ════════════════════════════════════════════════════════════

export default function DepositPage() {
  const { data: me, isLoading } = useMe();
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading) return <LoadingState message="Loading wallet…" />;

  const wallet = me?.wallet;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link href="/wallet" className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition">
          <ArrowLeft className="w-4 h-4 text-ink" />
        </Link>
        <h1 className="font-display font-bold text-[20px] text-ink">Add money</h1>
      </div>

      {/* Instructions */}
      <div className="bg-paper border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-[15px] text-ink">Bank Transfer</p>
            <p className="text-[12px] text-ink-soft">Fund your Agriqcap wallet</p>
          </div>
        </div>

        <p className="text-[13px] text-ink-soft mb-4 leading-relaxed">
          Transfer to the account details below from any Nigerian bank. Funds appear instantly.
        </p>

        {wallet?.account_number ? (
          <div className="space-y-3">
            {/* Account number */}
            <div className="bg-parchment rounded-xl p-4">
              <p className="text-[11px] text-ink-soft uppercase tracking-wider mb-1">Account Number</p>
              <div className="flex items-center justify-between">
                <p className="font-mono font-semibold text-[22px] text-ink">{wallet.account_number}</p>
                <button
                  onClick={() => copy(wallet.account_number!, "acct")}
                  className="flex items-center gap-1.5 bg-indigo text-white text-[12px] font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-deep transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied === "acct" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Bank name */}
            <div className="bg-parchment rounded-xl p-4">
              <p className="text-[11px] text-ink-soft uppercase tracking-wider mb-1">Bank</p>
              <p className="font-semibold text-[16px] text-ink">Safe Haven MFB</p>
            </div>

            {/* Account name */}
            <div className="bg-parchment rounded-xl p-4">
              <p className="text-[11px] text-ink-soft uppercase tracking-wider mb-1">Account Name</p>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[15px] text-ink">{me?.profile?.full_name || "Agriqcap Wallet"}</p>
                <button
                  onClick={() => copy(me?.profile?.full_name || "", "name")}
                  className="w-8 h-8 rounded-lg bg-track flex items-center justify-center hover:bg-line transition"
                >
                  <Copy className="w-3.5 h-3.5 text-ink-soft" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-ochre-light rounded-xl p-4 text-center">
            <p className="text-[13px] text-ink-soft">
              Your virtual account is being set up. This may take a few minutes after sign-up.
            </p>
          </div>
        )}
      </div>

      {/* Notice */}
      <div className="bg-loam-light rounded-xl p-4">
        <p className="text-[14px] text-ink leading-relaxed">
          <strong>Instant settlement.</strong> Transfers from all Nigerian banks settle immediately.
          Funds will appear in your Available Balance as soon as they arrive.
        </p>
      </div>
    </div>
  );
}
