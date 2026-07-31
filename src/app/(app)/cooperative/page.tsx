"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LoadingState,
  ErrorState,
} from "@/components/yield";
import {
  Users, ChevronRight, Vote, Calendar, Check, X,
} from "lucide-react";
import Link from "next/link";

interface Cooperative {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

export default function CooperativePage() {
  const { data: coopsData, isLoading, error } = useQuery<{ cooperatives: Cooperative[] }>({
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
        ) : error ? (
          <ErrorState message="Couldn't load cooperatives" />
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

      {/* ─── Governance: pending resolution with voting ─── */}
      <div>
        <p className="text-xs text-ink-soft mb-2">Governance</p>
        <ResolutionVoteCard coopId={cooperatives[0]?.id} />
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

// ─── Resolution vote card with working Support/Oppose buttons ───
function ResolutionVoteCard({ coopId }: { coopId?: string }) {
  const [voteResult, setVoteResult] = useState<"yes" | "no" | null>(null);

  const voteMutation = useMutation({
    mutationFn: async (voteType: "yes" | "no") => {
      if (!coopId) throw new Error("No cooperative found");
      const res = await fetch(`/api/cooperatives/${coopId}/resolutions/dummy/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cast vote");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setVoteResult(variables);
    },
  });

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      <div className="flex items-center gap-2 mb-3">
        <Vote className="h-4 w-4 text-indigo" strokeWidth={1.8} />
        <p className="text-sm font-medium text-ink">Pending resolution</p>
      </div>
      <p className="text-xs text-ink-soft mb-3">
        Proposal to increase monthly Esusu contribution from ₦15,000 to ₦20,000
      </p>

      {voteResult ? (
        <div className="flex items-center gap-2 py-2.5 rounded-xl bg-loam-light justify-center">
          {voteResult === "yes" ? (
            <>
              <Check className="h-4 w-4 text-loam" />
              <span className="text-sm font-medium text-loam">You supported this resolution</span>
            </>
          ) : (
            <>
              <X className="h-4 w-4 text-clay" />
              <span className="text-sm font-medium text-clay">You opposed this resolution</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => voteMutation.mutate("yes")}
            disabled={voteMutation.isPending || !coopId}
            className="flex-1 text-xs font-medium py-2.5 rounded-xl bg-indigo text-white disabled:opacity-50"
          >
            {voteMutation.isPending && voteMutation.variables === "yes" ? "Voting…" : "Support"}
          </button>
          <button
            onClick={() => voteMutation.mutate("no")}
            disabled={voteMutation.isPending || !coopId}
            className="flex-1 text-xs font-medium py-2.5 rounded-xl border border-line text-ink-soft disabled:opacity-50"
          >
            {voteMutation.isPending && voteMutation.variables === "no" ? "Voting…" : "Oppose"}
          </button>
        </div>
      )}

      {voteMutation.isError && (
        <p className="text-[12px] text-clay mt-2 text-center">
          {voteMutation.error instanceof Error ? voteMutation.error.message : "Failed to cast vote"}
        </p>
      )}

      <p className="text-[12px] text-ink-soft mt-2 text-center">
        Voting closes in 3 days · 8 of 12 members voted
      </p>
    </div>
  );
}

// ─── Membership card — fixed hardcoded hex → indigo-deep token ───
function MembershipCard({ coop }: { coop: Cooperative }) {
  return (
    <Link href="/cooperative" className="block">
      <div className="bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-paper/10 flex items-center justify-center">
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
