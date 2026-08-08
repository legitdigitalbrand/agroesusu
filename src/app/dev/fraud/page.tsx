"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/yield";
import { Search, ChevronLeft, ChevronRight, ShieldAlert, Plus, X, AlertTriangle } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

interface FraudFlag {
  id: string;
  flag_id: string;
  customer_name: string | null;
  title: string;
  description: string;
  flag_type: string;
  severity: string;
  status: string;
  detected_by: string;
  assigned_name: string | null;
  auto_action: string | null;
  created_at: string;
}

interface FraudStats {
  open: number;
  investigating: number;
  critical: number;
  confirmed: number;
}

const STATUS_TABS = ["all", "open", "investigating", "confirmed", "false_positive", "resolved"] as const;

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-parchment text-ink-soft",
  medium: "bg-indigo/10 text-indigo",
  high: "bg-ochre/10 text-ochre",
  critical: "bg-clay/10 text-clay",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-clay/10 text-clay",
  investigating: "bg-ochre/10 text-ochre",
  confirmed: "bg-clay/20 text-clay",
  false_positive: "bg-loam/10 text-loam",
  resolved: "bg-parchment text-ink-soft",
};

export default function AdminFraudPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{ flags: FraudFlag[]; total: number; stats: FraudStats }>({
    queryKey: ["admin-fraud", search, tab, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), skip: String(page * limit) });
      if (search) params.set("search", search);
      if (tab !== "all") params.set("status", tab);
      const res = await fetch(`/api/admin/fraud?${params}`);
      if (!res.ok) throw new Error("Failed to load fraud flags");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const flags = data?.flags || [];
  const total = data?.total || 0;
  const stats = data?.stats;
  const totalPages = Math.ceil(total / limit);

  const handleAction = async (flagId: string, action: string, note?: string) => {
    setActionLoading(flagId);
    try {
      const res = await fetch(`/api/admin/fraud/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resolution_note: note }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Action failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-fraud"] });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Fraud & Risk Monitor</h1>
          <p className="text-sm text-ink-soft mt-0.5">Investigate suspicious activity and manage fraud flags</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 transition"
        >
          <Plus className="h-4 w-4" /> New Flag
        </button>
      </div>

      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Open" value={stats.open} color="text-clay" />
          <SummaryCard label="Investigating" value={stats.investigating} color="text-ochre" />
          <SummaryCard label="Critical (Active)" value={stats.critical} color="text-clay" />
          <SummaryCard label="Confirmed Fraud" value={stats.confirmed} color="text-clay" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(0); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap capitalize ${
              tab === t ? "border-indigo text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t === "all" ? "All" : t.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by title, flag ID, customer name…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      {isLoading ? (
        <LoadingState message="Loading fraud flags…" />
      ) : error ? (
        <ErrorState message="Couldn't load fraud flags" onRetry={() => refetch()} />
      ) : flags.length === 0 ? (
        <div className="ys-card text-center py-12">
          <ShieldAlert className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No fraud flags found.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {flags.map(flag => (
              <div key={flag.id} className="ys-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[flag.severity] || "bg-parchment text-ink-soft"}`}>
                        {flag.severity}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[flag.status] || "bg-parchment text-ink-soft"}`}>
                        {flag.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-ink-soft font-mono">{flag.flag_id}</span>
                      {flag.auto_action && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-clay/10 text-clay">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />{flag.auto_action.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-ink mt-2">{flag.title}</h3>
                    <p className="text-sm text-ink-soft mt-1">{flag.description}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-soft">
                      <span>Type: <span className="font-medium text-ink">{flag.flag_type.replace(/_/g, " ")}</span></span>
                      <span>Customer: <span className="font-medium text-ink">{flag.customer_name || "—"}</span></span>
                      <span>Detected by: <span className="font-medium text-ink">{flag.detected_by}</span></span>
                      <span>Assigned: <span className="font-medium text-ink">{flag.assigned_name || "Unassigned"}</span></span>
                      <span>{formatRelativeTime(flag.created_at)}</span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {flag.status === "open" && !flag.assigned_name && (
                      <button
                        onClick={() => handleAction(flag.id, "assign")}
                        disabled={actionLoading === flag.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line text-ink hover:bg-parchment disabled:opacity-50 transition whitespace-nowrap"
                      >
                        Assign to me
                      </button>
                    )}
                    {(flag.status === "open" || flag.status === "investigating") && (
                      <>
                        <button
                          onClick={() => handleAction(flag.id, "confirm_fraud", "Confirmed fraud")}
                          disabled={actionLoading === flag.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-clay text-white hover:bg-clay/90 disabled:opacity-50 transition whitespace-nowrap"
                        >
                          Confirm fraud
                        </button>
                        <button
                          onClick={() => handleAction(flag.id, "false_positive", "False positive")}
                          disabled={actionLoading === flag.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line text-ink hover:bg-parchment disabled:opacity-50 transition whitespace-nowrap"
                        >
                          False positive
                        </button>
                      </>
                    )}
                    {(flag.status === "confirmed" || flag.status === "false_positive") && (
                      <button
                        onClick={() => handleAction(flag.id, "reopen")}
                        disabled={actionLoading === flag.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line text-ink hover:bg-parchment disabled:opacity-50 transition whitespace-nowrap"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
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

      {showCreate && <CreateFlagModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ["admin-fraud"] }); }} />}
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

function CreateFlagModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [flagType, setFlagType] = useState("manual_review");
  const [severity, setSeverity] = useState("medium");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          flag_type: flagType,
          severity,
          customer_name: customerName.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create flag");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create flag");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-paper rounded-2xl border border-line p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-ink">New Fraud Flag</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Flag title" className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the suspicious activity…" rows={4} className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 resize-none" />
          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)" className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20" />
          <div className="flex gap-3">
            <select value={flagType} onChange={e => setFlagType(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20">
              <option value="manual_review">Manual Review</option>
              <option value="staff_flagged">Staff Flagged</option>
              <option value="unusual_transaction_volume">Unusual Transaction Volume</option>
              <option value="suspicious_withdrawal_pattern">Suspicious Withdrawal Pattern</option>
              <option value="unusual_transfer_pattern">Unusual Transfer Pattern</option>
              <option value="duplicate_bvn">Duplicate BVN</option>
              <option value="kyc_discrepancy">KYC Discrepancy</option>
              <option value="multiple_failed_logins">Multiple Failed Logins</option>
              <option value="unusual_login_location">Unusual Login Location</option>
              <option value="chargeback_dispute">Chargeback Dispute</option>
              <option value="system_alert">System Alert</option>
            </select>
            <select value={severity} onChange={e => setSeverity(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {error && <p className="text-sm text-clay">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition">Cancel</button>
            <button onClick={handleCreate} disabled={!title.trim() || !description.trim() || loading} className="flex-1 py-2.5 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 disabled:opacity-50 transition">
              {loading ? "Creating…" : "Create Flag"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
