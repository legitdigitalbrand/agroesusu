"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

// Transfer page — placeholder until P2P transfer API is wired
export default function TransferPage() {
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/wallet" className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition">
          <ArrowLeft className="w-4 h-4 text-ink" />
        </Link>
        <h1 className="font-display font-bold text-[20px] text-ink">Transfer</h1>
      </div>

      <div className="bg-paper border border-line rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-parchment flex items-center justify-center mx-auto mb-4">
          <Send className="w-7 h-7 text-ink-soft" strokeWidth={1.5} />
        </div>
        <p className="font-display font-semibold text-[16px] text-ink mb-2">Transfers coming soon</p>
        <p className="text-[13px] text-ink-soft leading-relaxed mb-4">
          Wallet-to-wallet transfers will be available shortly. You can fund your savings or
          pay into cooperatives from your wallet right now.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/savings"
            className="bg-indigo text-white font-semibold text-[13px] px-4 py-2.5 rounded-xl hover:opacity-90 transition"
          >
            Fund savings
          </Link>
          <Link
            href="/cooperative"
            className="bg-parchment text-ink font-medium text-[13px] px-4 py-2.5 rounded-xl border border-line hover:bg-track transition"
          >
            Pay co-op
          </Link>
        </div>
      </div>
    </div>
  );
}
