"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { ArrowLeft, Lock, Unlock, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { formatNaira, formatDateTime } from "@/lib/format";

interface WalletDetail {
  id: string;
  account_number: string | null;
  account_name: string | null;
  bank_name: string | null;
  balance: number;
  user_id: string;
}
interface Transaction {
  id: string;
  transaction_reference: string;
  transaction_type: string;
  amount: number;
  status: string;
  description: string;
  initiated_at: string;
  source_module: string;
}

export default function WalletDetailPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const [modal, setModal] = useState<{ action: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{
    wallet: WalletDetail;
    customer: { id: string; full_name: string; customer_number: string; status: string } | null;
    transactions: Transaction[];
  }>({
    queryKey: ["admin-wallet", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/wallets/${walletId}`);
      if (!res.ok) throw new Error("Failed to load wallet");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const handleAction = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    setModalError(null);
    try {
      const body: Record<string, unknown> = { action: modal?.action, reason };
      if (modal?.action === "adjust") body.amount = parseFloat(adjustAmount) || 0;

      const res = await fetch(`/api/admin/wallets/${walletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Action failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-wallet", walletId] });
      setModal(null);
      setReason("");
      setAdjustAmount("");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading wallet…" />;
  if (error || !data) return <ErrorState message="Couldn't load wallet" onRetry={() => refetch()} />;

  const { wallet, customer, transactions } = data;

  return (
    <div className="space-y-6">
      <Link href="/dev/wallets" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition">
        <ArrowLeft className="h-4 w-4" /> Back to wallets
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-ink font-mono">{wallet.account_number || "No Account #"}</h1>
          </div>
          <p className="text-sm text-ink-soft mt-1">{customer?.full_name || "Unknown"} · {customer?.customer_number || ""}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setModal({ action: "freeze", label: "Freeze Wallet" }); setReason(""); setModalError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition"
          >
            <Lock className="h-4 w-4" /> Freeze
          </button>
          <button
            onClick={() => { setModal({ action: "unfreeze", label: "Unfreeze Wallet" }); setReason(""); setModalError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition"
          >
            <Unlock className="h-4 w-4" /> Unfreeze
          </button>
          <button
            onClick={() => { setModal({ action: "adjust", label: "Adjust Balance" }); setReason(""); setModalError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition"
          >
            <AlertTriangle className="h-4 w-4" /> Adjust
          </button>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-line bg-paper p-4">
          <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Balance</p>
          <p className="mt-1 text-xl font-semibold text-ink">{formatNaira(Number(wallet.balance) || 0)}</p>
        </div>
        <div className="rounded-lg border border-line bg-paper p-4">
          <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Bank</p>
          <p className="mt-1 text-sm text-ink">{wallet.bank_name || "—"}</p>
        </div>
        <div className="rounded-lg border border-line bg-paper p-4">
          <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Customer Status</p>
          <p className="mt-1 text-sm"><StatusBadge status={customer?.status || "unknown"} /></p>
        </div>
        <div className="rounded-lg border border-line bg-paper p-4">
          <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Account Name</p>
          <p className="mt-1 text-sm text-ink">{wallet.account_name || "—"}</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="ys-card">
        <h3 className="text-sm font-medium text-ink mb-3">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-soft py-4 text-center">No recent transactions.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-track/60">
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-2 pr-4">Reference</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-2 pr-4">Type</th>
                <th className="text-right text-xs font-medium text-ink-soft uppercase tracking-wide pb-2 pr-4">Amount</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-2 pr-4">Status</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-track/30 last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs text-ink">{tx.transaction_reference}</td>
                  <td className="py-2 pr-4 text-sm text-ink">{tx.transaction_type}</td>
                  <td className="py-2 pr-4 text-sm text-right font-medium text-ink">{formatNaira(Number(tx.amount) || 0)}</td>
                  <td className="py-2 pr-4"><StatusBadge status={tx.status} /></td>
                  <td className="py-2 text-sm text-ink-soft">{formatDateTime(tx.initiated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Action modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModal(null)}>
          <div className="bg-paper rounded-2xl border border-line p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-ink">{modal.label}</h3>
              <button onClick={() => setModal(null)} className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
            </div>

            {modal.action === "adjust" && (
              <div className="mb-3">
                <label className="text-xs text-ink-soft uppercase tracking-wide">Amount (positive to credit, negative to debit)</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 5000 or -2000"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20"
                />
              </div>
            )}

            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason (required)…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20 resize-none"
            />

            {modalError && (
              <div className="mt-2 text-sm text-clay flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> {modalError}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={!reason.trim() || (modal.action === "adjust" && !adjustAmount) || loading}
                className="flex-1 py-2.5 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 disabled:opacity-50 transition"
              >
                {loading ? "Processing…" : `Confirm ${modal.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
