"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { Scale, AlertCircle, CheckCircle, XCircle } from "lucide-react";

import { formatNaira, formatDateTime, formatRelativeTime } from "@/lib/format";
interface UnmatchedCredit {
  id: string;
  account_number: string;
  amount: number;
  sender_name: string | null;
  sender_account: string | null;
  reference: string | null;
  status: string;
  created_at: string;
}

interface FailedEvent {
  id: string;
  event_type: string;
  processing_status: string;
  error_message: string | null;
  received_at: string;
  correlation_id: string;
}

interface ReconFlag {
  id: string;
  wallet_id: string;
  our_balance: number;
  sh_balance: number;
  discrepancy_amount: number;
  discrepancy_direction: string;
  status: string;
  resolution_type: string | null;
  resolution_notes: string | null;
  created_at: string;
  checked_at: string | null;
}

type Tab = "unmatched" | "failed_events" | "flags";

export default function AdminReconciliationPage() {
  const [tab, setTab] = useState<Tab>("unmatched");

  const [showResolve, setShowResolve] = useState<UnmatchedCredit | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{
    unmatched_credits: UnmatchedCredit[];
    failed_events: FailedEvent[];
    reconciliation_flags: ReconFlag[];
    summary: { unmatched: number; failed_events: number; recon_flags: number };
  }>({
    queryKey: ["admin-reconciliation"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reconciliation?limit=50");
      if (!res.ok) throw new Error("Failed to load reconciliation data");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const unmatched = data?.unmatched_credits || [];
  const failedEvents = data?.failed_events || [];
  const flags = data?.reconciliation_flags || [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Reconciliation</h1>
        <p className="text-sm text-ink-soft mt-0.5">Match unmatched credits, review failed events, and resolve balance discrepancies</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Unmatched Credits" value={summary.unmatched} color="text-ochre" icon={AlertCircle} />
          <SummaryCard label="Failed Events" value={summary.failed_events} color="text-clay" icon={XCircle} />
          <SummaryCard label="Recon Flags" value={summary.recon_flags} color="text-clay" icon={Scale} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        <TabButton tab={tab} value="unmatched" onClick={() => setTab("unmatched")} label="Unmatched Credits" count={unmatched.length} />
        <TabButton tab={tab} value="failed_events" onClick={() => setTab("failed_events")} label="Failed Events" count={failedEvents.length} />
        <TabButton tab={tab} value="flags" onClick={() => setTab("flags")} label="Balance Flags" count={flags.length} />
      </div>

      {isLoading ? (
        <LoadingState message="Loading reconciliation data…" />
      ) : error ? (
        <ErrorState message="Couldn't load reconciliation data" onRetry={() => refetch()} />
      ) : (
        <>
          {/* Unmatched Credits */}
          {tab === "unmatched" && (
            <div className="space-y-3">
              {unmatched.length === 0 ? (
                <div className="ys-card text-center py-12">
                  <CheckCircle className="h-8 w-8 text-loam mx-auto" />
                  <p className="mt-3 text-sm text-ink-soft">No unmatched credits. All clear!</p>
                </div>
              ) : (
                unmatched.map(uc => (
                  <div key={uc.id} className="ys-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink">{formatNaira(uc.amount)}</span>
                          <StatusBadge status={uc.status} />
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-soft">
                          <span>Account: <span className="font-mono text-ink">{uc.account_number}</span></span>
                          <span>Sender: <span className="text-ink">{uc.sender_name || "Unknown"}</span></span>
                          {uc.sender_account && <span>From: <span className="font-mono text-ink">{uc.sender_account}</span></span>}
                          <span>{formatRelativeTime(uc.created_at)}</span>
                        </div>
                        {uc.reference && <p className="text-xs text-ink-soft mt-1">Ref: {uc.reference}</p>}
                      </div>
                      <button
                        onClick={() => setShowResolve(uc)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo text-white text-xs font-medium hover:bg-indigo/90 transition whitespace-nowrap"
                      >
                        <Scale className="h-3.5 w-3.5" /> Resolve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Failed Events */}
          {tab === "failed_events" && (
            <div className="ys-card overflow-x-auto">
              {failedEvents.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-8 w-8 text-loam mx-auto" />
                  <p className="mt-3 text-sm text-ink-soft">No failed events. All good!</p>
                </div>
              ) : (
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-track/60">
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Event Type</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Error</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Correlation ID</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedEvents.map(ev => (
                      <tr key={ev.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                        <td className="py-3 pr-4 text-sm text-ink font-medium">{ev.event_type}</td>
                        <td className="py-3 pr-4"><StatusBadge status={ev.processing_status} /></td>
                        <td className="py-3 pr-4 text-sm text-clay max-w-[200px] truncate" title={ev.error_message || ""}>{ev.error_message || "—"}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-ink-soft truncate max-w-[120px]">{ev.correlation_id}</td>
                        <td className="py-3 text-sm text-ink-soft">{formatDateTime(ev.received_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Balance Flags */}
          {tab === "flags" && (
            <div className="space-y-3">
              {flags.length === 0 ? (
                <div className="ys-card text-center py-12">
                  <CheckCircle className="h-8 w-8 text-loam mx-auto" />
                  <p className="mt-3 text-sm text-ink-soft">No balance discrepancies. All balanced!</p>
                </div>
              ) : (
                flags.map(f => (
                  <div key={f.id} className="ys-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            f.discrepancy_direction === 'our_higher' ? 'bg-loam/10 text-loam' : 'bg-clay/10 text-clay'
                          }`}>
                            {f.discrepancy_direction === 'our_higher' ? 'We have more' : 'Safe Haven has more'}
                          </span>
                          <StatusBadge status={f.status} />
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-soft">
                          <span>Our balance: <span className="font-medium text-ink">{formatNaira(f.our_balance)}</span></span>
                          <span>SH balance: <span className="font-medium text-ink">{formatNaira(f.sh_balance)}</span></span>
                          <span className="text-clay">Discrepancy: <span className="font-medium">{formatNaira(f.discrepancy_amount)}</span></span>
                          <span>{formatRelativeTime(f.created_at)}</span>
                        </div>
                        {f.resolution_notes && <p className="text-xs text-ink-soft mt-1">Resolution: {f.resolution_notes}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {showResolve && (
        <ResolveModal
          credit={showResolve}
          onClose={() => setShowResolve(null)}
          onResolved={() => {
            setShowResolve(null);
            queryClient.invalidateQueries({ queryKey: ["admin-reconciliation"] });
          }}
        />
      )}
    </div>
  );
}

function TabButton({ tab, value, onClick, label, count }: { tab: string; value: string; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
        tab === value ? "border-indigo text-ink" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {label}
      {count > 0 && <span className="text-xs bg-clay/10 text-clay px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}

function SummaryCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">{label}</p>
      </div>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ResolveModal({ credit, onClose, onResolved }: { credit: UnmatchedCredit; onClose: () => void; onResolved: () => void }) {
  const [action, setAction] = useState<"match" | "reverse">("match");
  const [reason, setReason] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async () => {
    if (reason.length < 10) { setError("Reason must be at least 10 characters"); return; }
    if (action === "match" && (!customerId.trim() || !walletId.trim())) { setError("Customer ID and Wallet ID required for matching"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          unmatched_credit_id: credit.id,
          customer_id: customerId.trim() || undefined,
          wallet_id: walletId.trim() || undefined,
          reason,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to resolve");
      }
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-paper rounded-2xl border border-line p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-semibold text-ink mb-4">Resolve Unmatched Credit</h3>
        <div className="bg-parchment rounded-lg p-3 mb-4">
          <p className="text-sm text-ink"><span className="font-medium">{formatNaira(credit.amount)}</span> from {credit.sender_name || "Unknown"}</p>
          <p className="text-xs text-ink-soft mt-1">Account: <span className="font-mono">{credit.account_number}</span></p>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setAction("match")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${action === "match" ? "bg-indigo text-white border-indigo" : "border-line text-ink hover:bg-parchment"}`}>Match to Customer</button>
            <button onClick={() => setAction("reverse")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${action === "reverse" ? "bg-clay text-white border-clay" : "border-line text-ink hover:bg-parchment"}`}>Reverse to Sender</button>
          </div>
          {action === "match" && (
            <div className="space-y-2">
              <input type="text" value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Customer ID (UUID)" className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo/20" />
              <input type="text" value={walletId} onChange={e => setWalletId(e.target.value)} placeholder="Wallet ID (UUID)" className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo/20" />
            </div>
          )}
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for resolution (min 10 chars)…" rows={3} className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 resize-none" />
          {error && <p className="text-sm text-clay">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition">Cancel</button>
            <button onClick={handleResolve} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 disabled:opacity-50 transition">
              {loading ? "Resolving…" : "Resolve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
