"use client";

import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";

// Withdraw page — placeholder until Safe Haven withdrawal API is wired
export default function WithdrawPage() {
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/wallet" className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition">
          <ArrowLeft className="w-4 h-4 text-ink" />
        </Link>
        <h1 className="font-display font-bold text-[20px] text-ink">Withdraw</h1>
      </div>

      <div className="bg-paper border border-line rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-parchment flex items-center justify-center mx-auto mb-4">
          <ArrowUpRight className="w-7 h-7 text-ink-soft" strokeWidth={1.5} />
        </div>
        <p className="font-display font-semibold text-[16px] text-ink mb-2">Withdrawals coming soon</p>
        <p className="text-[13px] text-ink-soft leading-relaxed mb-4">
          Wallet withdrawals to your bank account will be available shortly.
          Contact support if you need an urgent withdrawal.
        </p>
        <Link
          href="/help"
          className="inline-block bg-indigo text-white font-semibold text-[13px] px-5 py-2.5 rounded-xl hover:opacity-90 transition"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
