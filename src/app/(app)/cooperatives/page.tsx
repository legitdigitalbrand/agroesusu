"use client";

import { useState } from "react";
import { Building2, ArrowLeft, Users, Shield, TrendingUp, Landmark, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, Button, StatusBadge } from "@/components/yield";
import { useMe } from "@/hooks/use-me";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function CooperativesPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);

  // Check waitlist status
  const { data: waitlistData } = useQuery<{ on_waitlist: boolean }>({
    queryKey: ["coop-waitlist"],
    queryFn: async () => {
      const res = await fetch("/api/me/preferences");
      if (!res.ok) return { on_waitlist: false };
      const data = await res.json();
      return { on_waitlist: !!data.coop_waitlist };
    },
  });

  const onWaitlist = waitlistData?.on_waitlist;

  const joinWaitlist = async () => {
    setJoining(true);
    try {
      await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coop_waitlist: true }),
      });
      queryClient.invalidateQueries({ queryKey: ["coop-waitlist"] });
    } catch {
      // ignore — will retry next session
    } finally {
      setJoining(false);
    }
  };

  const benefits = [
    {
      icon: TrendingUp,
      title: "Higher Loan Limits",
      description: "Cooperative members unlock larger loan amounts and better APRs through group savings history.",
    },
    {
      icon: Shield,
      title: "Shared Accountability",
      description: "Group members vouch for each other, building a trust profile that strengthens your credit score.",
    },
    {
      icon: Users,
      title: "Esusu Contributions",
      description: "Pool regular contributions with trusted members. Track payouts and build savings discipline together.",
    },
  ];

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* Hero Card */}
      <Card variant="dark" padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-7 w-7 text-ochre" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
              Esusu Groups &amp; Cooperatives
            </h1>
            <p className="text-sm text-white/80 mt-1.5 leading-relaxed">
              Join trusted savings circles and cooperative societies. Build credit,
              unlock higher loan limits, and grow your savings with community accountability.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <StatusBadge status="pending" size="sm" />
              <span className="text-xs text-white/70">Launching soon</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Benefits */}
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">Why Join a Cooperative?</h2>
        {benefits.map((b, i) => (
          <Card key={i} variant="elevated" padding="md">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-loam-light text-loam border border-loam/20 flex items-center justify-center flex-shrink-0">
                <b.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">{b.title}</h3>
                <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">{b.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Loan Connection */}
      <Card variant="elevated" padding="md">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo/10 text-indigo border border-indigo/20 flex items-center justify-center flex-shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Cooperative Membership &amp; Loans</h3>
            <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">
              Some loan products require cooperative membership. When you join an esusu group
              and maintain regular contributions, you build the savings history needed to
              qualify for these loans.
            </p>
          </div>
        </div>
      </Card>

      {/* Waitlist CTA */}
      <Card padding="lg" className="text-center">
        {onWaitlist ? (
          <div className="py-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-loam-light mb-3">
              <CheckCircle2 className="w-6 h-6 text-loam" />
            </div>
            <h3 className="font-display text-base font-semibold text-ink">You&apos;re on the list!</h3>
            <p className="text-sm text-ink-soft mt-1">
              We&apos;ll notify you as soon as esusu groups launch. Keep saving to build
              your credit profile in the meantime.
            </p>
            <Link href="/savings" className="inline-block mt-4">
              <Button variant="outline" size="sm">
                Continue Saving
              </Button>
            </Link>
          </div>
        ) : (
          <div className="py-2">
            <h3 className="font-display text-base font-semibold text-ink mb-1">
              Join the Waitlist
            </h3>
            <p className="text-sm text-ink-soft mb-4">
              Be the first to know when esusu groups go live. No commitment — just early access.
            </p>
            <Button
              variant="primary"
              onClick={joinWaitlist}
              disabled={joining || !me}
            >
              {joining ? "Adding you..." : "Notify Me When Live"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
