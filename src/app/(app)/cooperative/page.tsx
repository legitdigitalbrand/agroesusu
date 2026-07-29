"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LoadingState,
} from "@/components/yield";
import {
  Users, ChevronRight, Vote, Calendar,
} from "lucide-react";
import Link from "next/link";

// ════════════════════════════════════════════════════════════
// Mobile Cooperative — extends the established design system:
//   - Membership status cards
//   - Esusu group schedule (next contribution, payout position)
//   - Governance: pending resolutions/votes
//
// Design rules:
//   - Cards: border-line, rounded-2xl, bg-paper
//   - Indigo gradient for membership highlight
//   - Ochre for the single accent (vote CTA or join CTA)
//   - IBM Plex Mono for all amounts and dates
//   - Plus Jakarta Sans for headings
// ════════════════════════════════════════════════════════════

interface Cooperative {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

export default function CooperativePage() {
  const { data: coopsData, isLoading } = useQuery<{ cooperatives: Cooperative[] }>({
    queryKey: ["cooperatives"],
    queryFn: async () => {
      const res = await fetch("/api/cooperatives");
      if (!res.ok) return { cooperatives: [] };
      return res.json();
    },
  });

  const cooperatives = coopsData?.cooperatives || [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[22px] font-medium text-ink">Cooperative</h1>

      {/* ─── My memberships ─── */}
      <div>
        <p className="text-xs text-ink-soft mb-2">My cooperatives</p>
        {isLoading ? (
          <LoadingState message="Loading cooperatives…" />
        ) : cooperatives.length === 0 ? (
          <div className="border border-line rounded-2xl p-8 text-center">
            <Users className="h-8 w-8 text-ink-soft mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-ink-soft mb-3">You haven't joined a cooperative yet</p>
            <p className="text-xs text-ink-soft mb-4">Join a cooperative to access group savings, Esusu, and loans.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cooperatives.map((coop) => (
              <MembershipCard key={coop.id} coop={coop} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Esusu group schedule ─── */}
      <div>
        <p className="text-xs text-ink-soft mb-2">Esusu schedule</p>
        <div className="border border-line rounded-2xl p-4 bg-paper">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-loam-light flex items-center justify-center">
                <Calendar className="h-4 w-4 text-indigo" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Umuoji Esusu Group</p>
                <p className="text-[11px] text-ink-soft">12 members · ₦15,000/round</p>
              </div>
            </div>
            <span className="text-[12px] px-2 py-0.5 rounded-full bg-loam-light text-loam">Active</span>
          </div>

          {/* Position indicator */}
          <div className="bg-parchment rounded-xl p-3 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-ink-soft">Your payout position</span>
              <span className="font-mono text-sm text-ink">Position 4 of 12</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-ink-soft">Next contribution</span>
              <span className="font-mono text-sm text-ink">Aug 15, 2026</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-ink-soft">Your payout date</span>
              <span className="font-mono text-sm text-indigo">Dec 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Governance: pending votes ─── */}
      <div>
        <p className="text-xs text-ink-soft mb-2">Governance</p>
        <div className="border border-line rounded-2xl p-4 bg-paper">
          <div className="flex items-center gap-2 mb-3">
            <Vote className="h-4 w-4 text-indigo" strokeWidth={1.8} />
            <p className="text-sm font-medium text-ink">Pending resolution</p>
          </div>
          <p className="text-xs text-ink-soft mb-3">
            Proposal to increase monthly Esusu contribution from ₦15,000 to ₦20,000
          </p>
          <div className="flex gap-2">
            <button className="flex-1 text-xs font-medium py-2.5 rounded-xl bg-indigo text-white">
              Support
            </button>
            <button className="flex-1 text-xs font-medium py-2.5 rounded-xl border border-line text-ink-soft">
              Oppose
            </button>
          </div>
          <p className="text-[12px] text-ink-soft mt-2 text-center">
            Voting closes in 3 days · 8 of 12 members voted
          </p>
        </div>
      </div>

      {/* ─── Browse cooperatives ─── */}
      {cooperatives.length > 0 && (
        <div>
          <p className="text-xs text-ink-soft mb-2">Available cooperatives</p>
          {cooperatives.slice(0, 3).map((coop) => (
            <div key={coop.id} className="border border-line rounded-2xl p-4 bg-paper flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-ink">{coop.name}</p>
                <p className="text-[11px] text-ink-soft mt-0.5">{coop.member_count} members</p>
              </div>
              <Link href={`/cooperative`} className="text-xs px-3 py-1.5 rounded-lg bg-indigo text-white">
                Join
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Membership card ───
function MembershipCard({ coop }: { coop: Cooperative }) {
  return (
    <Link href="/cooperative" className="block">
      <div className="bg-gradient-to-br from-indigo to-[#0F4A13] rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{coop.name}</p>
            <p className="text-[11px] text-white/60">{coop.member_count} members</p>
          </div>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
        {coop.description && (
          <p className="text-[11px] text-white/60 line-clamp-2">{coop.description}</p>
        )}
      </div>
    </Link>
  );
}
