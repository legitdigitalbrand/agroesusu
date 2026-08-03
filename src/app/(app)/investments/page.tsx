"use client";

import { TrendingUp, ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { Card, Button, StatusBadge } from "@/components/yield";

export default function InvestmentsPage() {
  return (
    <div className="py-6 max-w-2xl mx-auto space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <Card variant="dark" padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-7 w-7 text-ochre" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
              Investment Products
            </h1>
            <p className="text-sm text-white/80 mt-1.5 leading-relaxed">
              Grow your capital with curated agricultural investment opportunities.
              From farm-backed bonds to seasonal crop pools.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <StatusBadge status="pending" size="sm" />
              <span className="text-xs text-white/70">Launching soon</span>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-loam-light mb-3">
          <Lock className="w-6 h-6 text-loam" />
        </div>
        <h3 className="font-display text-base font-semibold text-ink mb-1">
          Coming Soon
        </h3>
        <p className="text-sm text-ink-soft mb-4 max-w-sm mx-auto">
          We&apos;re building investment products tailored for Nigerian farmers and
          savers. You&apos;ll be able to invest in agricultural bonds, seasonal crop pools,
          and farm-backed securities.
        </p>
        <Link href="/savings">
          <Button variant="outline" size="sm">
            Explore Savings Options
          </Button>
        </Link>
      </Card>
    </div>
  );
}
