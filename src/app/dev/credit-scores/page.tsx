"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/yield";
import { Search, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";


interface RiskProfile {
  id: string;
  customer_id: string;
  risk_level: string;
  internal_credit_score: number;
  total_loans: number;
  active_loans: number;
  defaulted_loans: number;
  total_repayments: number;
  on_time_repayments: number;
  late_repayments: number;
  last_default_date: string | null;
  notes: string | null;
  customer: {
    full_name: string;
    customer_number: string;
    email: string | null;
    phone: string | null;
    status: string;
  } | null;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-loam/10 text-loam",
  medium: "bg-indigo/10 text-indigo",
  high: "bg-clay/10 text-clay",
  restricted: "bg-clay/20 text-clay",
};

export default function AdminCreditScoresPage() {
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery<{ profiles: RiskProfile[]; total: number }>({
    queryKey: ["admin-credit-scores", riskLevel, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), skip: String(page * limit) });
      if (riskLevel !== "all") params.set("risk_level", riskLevel);
      const res = await fetch(`/api/admin/credit-scores?${params}`);
      if (!res.ok) throw new Error("Failed to load credit scores");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const profiles = data?.profiles || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const filtered = search
    ? profiles.filter(p =>
        p.customer?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.customer?.customer_number?.toLowerCase().includes(search.toLowerCase())
      )
    : profiles;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Credit Scores</h1>
        <p className="text-sm text-ink-soft mt-0.5">Internal credit scoring and risk profiles</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Low Risk" value={profiles.filter(p => p.risk_level === "low").length} color="text-loam" />
        <SummaryCard label="Medium Risk" value={profiles.filter(p => p.risk_level === "medium").length} color="text-indigo" />
        <SummaryCard label="High Risk" value={profiles.filter(p => p.risk_level === "high").length} color="text-clay" />
        <SummaryCard label="Restricted" value={profiles.filter(p => p.risk_level === "restricted").length} color="text-clay" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or customer number…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <select value={riskLevel} onChange={e => { setRiskLevel(e.target.value); setPage(0); }} className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20">
          <option value="all">All Risk Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="restricted">Restricted</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingState message="Loading credit scores…" />
      ) : error ? (
        <ErrorState message="Couldn't load credit scores" onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <div className="ys-card text-center py-12">
          <ShieldCheck className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No risk profiles found.</p>
        </div>
      ) : (
        <>
          <div className="ys-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-track/60">
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Customer</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Score</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Risk Level</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Loans</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Defaults</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">On-time %</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Last Default</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const onTimePct = p.total_repayments > 0 ? Math.round((p.on_time_repayments / p.total_repayments) * 100) : 0;
                  return (
                    <tr key={p.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                      <td className="py-3 pr-4">
                        <p className="text-sm font-medium text-ink">{p.customer?.full_name || "Unknown"}</p>
                        <p className="text-xs text-ink-soft font-mono">{p.customer?.customer_number || ""}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-lg font-semibold ${
                          p.internal_credit_score >= 700 ? "text-loam" :
                          p.internal_credit_score >= 500 ? "text-ink" :
                          "text-clay"
                        }`}>{p.internal_credit_score}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[p.risk_level] || "bg-parchment text-ink-soft"}`}>{p.risk_level}</span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-ink">{p.total_loans} ({p.active_loans} active)</td>
                      <td className="py-3 pr-4 text-sm text-ink">{p.defaulted_loans}</td>
                      <td className="py-3 pr-4 text-sm text-ink">{onTimePct}%</td>
                      <td className="py-3 pr-4 text-sm text-ink-soft">{p.last_default_date ? new Date(p.last_default_date).toLocaleDateString() : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 rounded-lg border border-line text-ink disabled:opacity-40 hover:bg-parchment transition">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} className="p-2 rounded-lg border border-line text-ink disabled:opacity-40 hover:bg-parchment transition">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
