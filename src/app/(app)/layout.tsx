"use client";

import React from "react";
import { DesktopShell, MobileShell } from "@/components/yield/desktop-shell";
import { useMe } from "@/hooks/use-me";
import { LoadingState } from "@/components/yield";
import { PiggyBank, Landmark, TrendingUp } from "lucide-react";
import Link from "next/link";

// ════════════════════════════════════════════════════════════
// App layout — right rail uses design system tokens correctly.
// White icons on solid color backgrounds for legibility.
// ════════════════════════════════════════════════════════════

function DefaultRightRail() {
  const { data: me } = useMe();

  if (!me) return <LoadingState />;

  return (
    <>
      {/* Loan eligibility card */}
      <div className="bg-paper border border-line rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo flex items-center justify-center">
            <Landmark className="w-4 h-4 text-white" strokeWidth={1.8} />
          </div>
          <h3 className="font-display font-semibold text-[14px] text-ink">Loan Eligibility</h3>
        </div>
        <p className="text-[14px] text-ink-soft leading-relaxed mb-3">
          You can borrow up to 3× your eligible savings balance.
        </p>
        <Link
          href="/loans"
          className="block w-full text-center bg-ochre text-indigo-deep font-semibold text-[13px] py-2.5 rounded-xl hover:opacity-90 transition"
        >
          Check eligibility
        </Link>
      </div>

      {/* Grow Your Money card */}
      <div className="bg-indigo rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-ochre" strokeWidth={1.8} />
          </div>
          <h3 className="font-display font-semibold text-[14px] text-white">Grow Your Money</h3>
        </div>
        <p className="text-[14px] text-white/70 leading-relaxed mb-3">
          Invest in agricultural pools from ₦10,000. Earn up to 18% returns.
        </p>
        <Link
          href="/investments"
          className="block w-full text-center bg-white/15 text-white font-semibold text-[13px] py-2.5 rounded-xl hover:bg-white/20 transition"
        >
          Explore
        </Link>
      </div>

      {/* Savings nudge */}
      <div className="bg-paper border border-line rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-loam flex items-center justify-center">
            <PiggyBank className="w-4 h-4 text-white" strokeWidth={1.8} />
          </div>
          <h3 className="font-display font-semibold text-[14px] text-ink">Savings</h3>
        </div>
        <p className="text-[14px] text-ink-soft leading-relaxed mb-3">
          Open a savings account and start building your credit history.
        </p>
        <Link
          href="/savings"
          className="block w-full text-center bg-loam text-white font-semibold text-[13px] py-2.5 rounded-xl hover:bg-loam-dim transition"
        >
          Open account
        </Link>
      </div>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="md:hidden">
        <MobileShell>{children}</MobileShell>
      </div>
      <div className="hidden md:block">
        <DesktopShell rightRail={<DefaultRightRail />}>{children}</DesktopShell>
      </div>
    </>
  );
}
