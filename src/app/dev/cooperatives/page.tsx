"use client";

// removed unused imports
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { Users } from "lucide-react";
import { formatRelativeTime, formatDate } from "@/lib/format";

interface Cooperative {
  id: string;
  cooperative_code: string;
  name: string;
  description: string | null;
  status: string;
  founded_date: string | null;
  config: Record<string, unknown>;
  created_at: string;
}


export default function AdminCooperativesPage() {

  const { data: coopsData, isLoading, error, refetch } = useQuery<{ cooperatives: Cooperative[] }>({
    queryKey: ["admin-cooperatives"],
    queryFn: async () => {
      const res = await fetch("/api/cooperatives");
      if (!res.ok) throw new Error("Failed to load cooperatives");
      return res.json();
    },
  });

  const cooperatives = coopsData?.cooperatives || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Cooperatives</h1>
        <p className="text-sm text-ink-soft mt-0.5">Manage cooperative societies, governance, and memberships</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Co-ops" value={String(cooperatives.length)} />
        <StatCard label="Active" value={String(cooperatives.filter(c => c.status === "active").length)} />
        <StatCard label="Draft" value={String(cooperatives.filter(c => c.status === "draft").length)} />
        <StatCard label="Suspended" value={String(cooperatives.filter(c => c.status === "suspended").length)} />
      </div>

      {isLoading ? (
        <LoadingState message="Loading cooperatives…" />
      ) : error ? (
        <ErrorState message="Couldn't load cooperatives" onRetry={() => refetch()} />
      ) : cooperatives.length === 0 ? (
        <div className="ys-card text-center py-12">
          <Users className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No cooperatives registered.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cooperatives.map(c => (
            <div key={c.id} className="ys-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-indigo/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-indigo" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-ink-soft font-mono">{c.cooperative_code}</p>
                    {c.description && <p className="text-xs text-ink-soft mt-1">{c.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-soft">
                      {c.founded_date && <span>Founded: <span className="font-medium text-ink">{formatDate(c.founded_date)}</span></span>}
                      <span>Created: <span className="font-medium text-ink">{formatRelativeTime(c.created_at)}</span></span>
                      {c.config && typeof c.config === "object" && (
                        <span>Quorum: <span className="font-medium text-ink">{String(c.config.voting_quorum_percentage || 50)}%</span></span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={c.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
