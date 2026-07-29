"use client";

import React from "react";
import { DesktopShell, MobileShell } from "@/components/yield/desktop-shell";
import { useMe } from "@/hooks/use-me";
import { Card, ProgressRing, Button, LoadingState } from "@/components/yield";
import { PiggyBank, Landmark, TrendingUp } from "lucide-react";
import Link from "next/link";

// App layout wraps every authenticated customer page.
// Mobile: bottom floating pill nav + center FAB (Quick Deposit)
// Desktop: persistent sidebar + topbar + two-column main with right rail

function DefaultRightRail() {
  const { data: me } = useMe();

  if (!me) return <LoadingState />;

  const savings = me.summaries?.savings;
  const investments = me.summaries?.investments;

  return (
    <>
      {/* Savings goal progress */}
      {savings && savings.count > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <PiggyBank className="h-4 w-4 text-loam" />
            <h3 className="font-display text-sm text-ink">Savings Goal</h3>
          </div>
          <div className="flex items-center justify-center py-2">
            <ProgressRing progress={65} size={100} label="65%" sublabel="of goal" />
          </div>
          <div className="mt-3 text-center">
            <p className="font-mono text-lg text-ink">
              {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(savings.total_balance)}
            </p>
            <p className="text-xs text-ink-soft">across {savings.count} {savings.count === 1 ? "account" : "accounts"}</p>
          </div>
          <Link href="/savings" className="block mt-3">
            <Button size="sm" variant="ghost" className="w-full">View savings →</Button>
          </Link>
        </Card>
      )}

      {/* Loan eligibility teaser */}
      <Card className="bg-indigo/5 border-indigo/20">
        <div className="flex items-center gap-2 mb-2">
          <Landmark className="h-4 w-4 text-indigo" />
          <h3 className="font-display text-sm text-ink">Loan Eligibility</h3>
        </div>
        <p className="text-xs text-ink-soft mb-3">
          You can borrow up to 3× your eligible savings balance.
        </p>
        <Link href="/loans">
          <Button size="sm" className="w-full">Check eligibility</Button>
        </Link>
      </Card>

      {/* Investments teaser */}
      {investments && investments.count === 0 && (
        <Card className="bg-parchment">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-loam" />
            <h3 className="font-display text-sm text-ink">Grow Your Money</h3>
          </div>
          <p className="text-xs text-ink-soft mb-3">
            Invest in agricultural pools from ₦10,000. Earn up to 18% returns.
          </p>
          <Link href="/investments">
            <Button size="sm" variant="loam" className="w-full">Explore</Button>
          </Link>
        </Card>
      )}
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
