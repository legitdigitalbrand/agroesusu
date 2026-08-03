"use client";

import { Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/yield";

export default function CooperativesPage() {
  return (
    <div className="py-8 max-w-2xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <Card className="text-center py-12 px-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-loam-light mb-4">
          <Building2 className="h-8 w-8 text-loam" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-xl font-semibold text-ink mb-2">
          Esusu Groups — Coming Soon
        </h1>
        <p className="text-sm text-ink-soft leading-relaxed max-w-sm mx-auto mb-6">
          You'll soon be able to create and join esusu (group savings) circles
          with trusted members. Pool contributions, track payouts, and build
          credit together.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-parchment border border-line">
          <span className="h-2 w-2 rounded-full bg-ochre animate-pulse" />
          <span className="text-xs font-medium text-ink-soft">In development</span>
        </div>
      </Card>
    </div>
  );
}
