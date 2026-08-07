"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";

interface Verification {
  id: string;
  user_id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  status: string;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    bvn: string | null;
    nin: string | null;
    status: string;
  } | null;
  safe_haven: Array<{ type: string; status: string; verified_at: string | null }>;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "needs_review", label: "Needs Review" },
] as const;

export default function AdminVerificationPage() {
  const [tab, setTab] = useState<string>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{ verifications: Verification[]; total: number }>({
    queryKey: ["admin-verification", tab],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", skip: "0" });
      if (tab !== "all") params.set("status", tab);
      const res = await fetch(`/api/admin/verification?${params}`);
      if (!res.ok) throw new Error("Failed to load verifications");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const verifications = data?.verifications || [];

  const handleAction = async (id: string, action: string) => {
    const reason = notes[id] || "";
    if (!reason.trim()) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/verification/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, notes: reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Action failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-verification", tab] });
      setExpandedId(null);
      setNotes(n => ({ ...n, [id]: "" }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Verification Queue</h1>
        <p className="text-sm text-ink-soft mt-0.5">Review and process KYC document submissions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.key ? "border-indigo text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState message="Loading verifications…" />
      ) : error ? (
        <ErrorState message="Couldn't load verifications" onRetry={() => refetch()} />
      ) : verifications.length === 0 ? (
        <div className="ys-card text-center py-12">
          <CheckCircle2 className="h-8 w-8 text-loam mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No documents to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map(v => (
            <div key={v.id} className="ys-card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{v.customer?.full_name || "Unknown"}</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {v.doc_type} · Submitted {formatDate(v.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={v.status} />
                  {expandedId === v.id ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
                </div>
              </div>

              {expandedId === v.id && (
                <div className="mt-4 pt-4 border-t border-line space-y-4">
                  {/* Customer info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><p className="text-xs text-ink-soft uppercase">Email</p><p className="text-sm text-ink">{v.customer?.email || "—"}</p></div>
                    <div><p className="text-xs text-ink-soft uppercase">Phone</p><p className="text-sm text-ink">{v.customer?.phone || "—"}</p></div>
                    <div><p className="text-xs text-ink-soft uppercase">BVN</p><p className="text-sm text-ink font-mono">{v.customer?.bvn || "—"}</p></div>
                    <div><p className="text-xs text-ink-soft uppercase">NIN</p><p className="text-sm text-ink font-mono">{v.customer?.nin || "—"}</p></div>
                  </div>

                  {/* Safe Haven verification */}
                  {v.safe_haven.length > 0 && (
                    <div>
                      <p className="text-xs text-ink-soft uppercase mb-1">Safe Haven Identity</p>
                      <div className="flex gap-2">
                        {v.safe_haven.map((sh, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-full bg-parchment text-ink-soft">
                            {sh.type}: {sh.status}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Document link */}
                  {v.file_url && (
                    <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo hover:underline">
                      View document →
                    </a>
                  )}

                  {/* Notes */}
                  <textarea
                    value={notes[v.id] || ""}
                    onChange={e => setNotes(n => ({ ...n, [v.id]: e.target.value }))}
                    placeholder="Reason / notes (required for all actions)…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20 resize-none"
                  />

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAction(v.id, "approve")}
                      disabled={!notes[v.id]?.trim() || actionLoading === v.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-loam/10 text-loam text-sm font-medium hover:bg-loam/20 disabled:opacity-40 transition"
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(v.id, "reject")}
                      disabled={!notes[v.id]?.trim() || actionLoading === v.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-clay/10 text-clay text-sm font-medium hover:bg-clay/20 disabled:opacity-40 transition"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                    <button
                      onClick={() => handleAction(v.id, "request_resubmission")}
                      disabled={!notes[v.id]?.trim() || actionLoading === v.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment disabled:opacity-40 transition"
                    >
                      <AlertTriangle className="h-4 w-4" /> Request Resubmission
                    </button>
                    <button
                      onClick={() => handleAction(v.id, "escalate")}
                      disabled={!notes[v.id]?.trim() || actionLoading === v.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment disabled:opacity-40 transition"
                    >
                      <AlertTriangle className="h-4 w-4" /> Escalate
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
