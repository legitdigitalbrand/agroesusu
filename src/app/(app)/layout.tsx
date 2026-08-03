"use client";

import React from "react";
import { DesktopShell } from "@/components/yield/desktop-shell";
import { MobileShell } from "@/components/yield/mobile-shell";
import { useMe } from "@/hooks/use-me";
import { LoadingState } from "@/components/yield";
import { PiggyBank, Landmark } from "lucide-react";
import Link from "next/link";

// ════════════════════════════════════════════════════════════
// App layout — right rail only renders on dashboard (A3 fix).
// The nudge cards below are dashboard-only contextual content.
// ════════════════════════════════════════════════════════════

function DefaultRightRail() {
  const { data: me } = useMe();

  if (!me) return <LoadingState />;

  return (
    <>
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
        <Link href="/savings" className="block w-full text-center bg-loam text-white font-semibold text-[13px] py-2.5 rounded-xl hover:bg-loam-dim transition">
          Open account
        </Link>
      </div>

      <div className="bg-paper border border-line rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo flex items-center justify-center">
            <Landmark className="w-4 h-4 text-white" strokeWidth={1.8} />
          </div>
          <h3 className="font-display font-semibold text-[14px] text-ink">Loan Eligibility</h3>
        </div>
        <p className="text-[14px] text-ink-soft leading-relaxed mb-3">
          You can borrow up to 3x your eligible savings balance.
        </p>
        <Link href="/loans" className="block w-full text-center bg-ochre text-indigo-deep font-semibold text-[13px] py-2.5 rounded-xl hover:opacity-90 transition">
          Check eligibility
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
