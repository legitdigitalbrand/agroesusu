"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { ArrowLeft, Lock, Unlock, Flag, KeyRound, Ban, CheckCircle, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { formatNaira, formatDate, formatDateTime } from "@/lib/format";

interface Customer {
  id: string;
  customer_number: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  bvn: string | null;
  nin: string | null;
  status: string;
  registration_date: string;
  activation_date: string | null;
  created_at: string;
  auth_id: string;
}
interface Wallet {
  id: string;
  account_number: string | null;
  account_name: string | null;
  bank_name: string | null;
  balance: number;
  status: string;
}
interface SavingsAccount {
  id: string;
  product_id: string;
  status: string;
  balance: number;
  interest_rate: number;
  opened_at: string;
  nickname: string | null;
  goal_enabled: boolean;
  goal_amount: number | null;
}
interface Loan {
  id: string;
  principal_amount: number;
  outstanding_balance: number;
  interest_rate: number;
  monthly_repayment: number;
  status: string;
  duration_months: number;
  created_at: string;
}
interface Transaction {
  id: string;
  transaction_reference: string;
  transaction_type: string;
  amount: number;
  status: string;
  description: string;
  initiated_at: string;
}
interface TimelineEvent {
  id: string;
  type: string;
  action: string;
  entity_type: string | null;
  timestamp: string;
  actor: string;
}

const TABS = ["Overview", "Wallet", "Savings", "Loans", "Transactions", "Audit Trail"] as const;
type Tab = typeof TABS[number];

export default function CustomerProfilePage({ params }: { params: { customerId: string } }) {
  const { customerId } = params;
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [actionModal, setActionModal] = useState<{ action: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{
    customer: Customer;
    wallet: Wallet | null;
    savingsAccounts: SavingsAccount[];
    loans: Loan[];
    recentTransactions: Transaction[];
  }>({
    queryKey: ["admin-customer", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/customers/${customerId}`);
      if (!res.ok) throw new Error("Failed to load customer");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: timeline } = useQuery<{ events: TimelineEvent[] }>({
    queryKey: ["admin-customer-timeline", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/customers/${customerId}/timeline`);
      if (!res.ok) return { events: [] };
      return res.json();
    },
    staleTime: 60 * 1000,
    enabled: activeTab === "Audit Trail",
  });

  const handleAction = async () => {
    if (!reason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionModal?.action, reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Action failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-customer", customerId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-customer-timeline", customerId] });
      setActionModal(null);
      setReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading customer…" />;
  if (error || !data) return <ErrorState message="Couldn't load customer" onRetry={() => refetch()} />;

  const { customer, wallet, savingsAccounts, loans, recentTransactions } = data;

  const actions = [
    ...(customer.status === "active" ? [{ action: "suspend", label: "Suspend", icon: Ban, color: "text-clay" }] : []),
    ...(customer.status === "suspended" ? [{ action: "unsuspend", label: "Unsuspend", icon: CheckCircle, color: "text-loam" }] : []),
    { action: "freeze_wallet", label: "Freeze Wallet", icon: Lock, color: "text-clay" },
    { action: "unfreeze_wallet", label: "Unfreeze Wallet", icon: Unlock, color: "text-loam" },
    { action: "reset_pin", label: "Reset PIN", icon: KeyRound, color: "text-ink" },
    { action: "flag_fraud", label: "Flag Fraud", icon: Flag, color: "text-clay" },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/dev/customers" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-ink">{customer.full_name}</h1>
            <StatusBadge status={customer.status} />
          </div>
          <p className="text-sm text-ink-soft mt-1 font-mono">{customer.customer_number}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            Joined {customer.registration_date ? formatDate(customer.registration_date) : "—"}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {actions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.action}
                onClick={() => { setActionModal({ action: a.action, label: a.label }); setReason(""); setActionError(null); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition"
              >
                <Icon className="h-4 w-4" /> {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === t
                ? "border-indigo text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab === "Overview" && (
          <div className="ys-card">
            <h3 className="text-sm font-medium text-ink mb-4">Personal Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Detail label="Full Name" value={customer.full_name} />
              <Detail label="Email" value={customer.email || "—"} />
              <Detail label="Phone" value={customer.phone || "—"} />
              <Detail label="BVN" value={customer.bvn || "—"} mono />
              <Detail label="NIN" value={customer.nin || "—"} mono />
              <Detail label="Status" value={<StatusBadge status={customer.status} />} />
              <Detail label="Registration Date" value={customer.registration_date ? formatDate(customer.registration_date) : "—"} />
              <Detail label="Activation Date" value={customer.activation_date ? formatDate(customer.activation_date) : "—"} />
            </div>
          </div>
        )}

        {activeTab === "Wallet" && (
          <div className="space-y-4">
            {wallet ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatTile label="Balance" value={formatNaira(Number(wallet.balance) || 0)} />
                  <StatTile label="Account #" value={wallet.account_number || "—"} />
                  <StatTile label="Bank" value={wallet.bank_name || "—"} />
                  <StatTile label="Status" value={<StatusBadge status={wallet.status || "active"} />} />
                </div>
                <div className="ys-card">
                  <h3 className="text-sm font-medium text-ink mb-3">Recent Wallet Transactions</h3>
                  {recentTransactions.length === 0 ? (
                    <p className="text-sm text-ink-soft py-4 text-center">No recent transactions.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentTransactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b border-track/20 last:border-0">
                          <div>
                            <p className="text-sm text-ink">{tx.description || tx.transaction_type}</p>
                            <p className="text-xs text-ink-soft font-mono">{tx.transaction_reference}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-ink">{formatNaira(Number(tx.amount) || 0)}</p>
                            <p className="text-xs text-ink-soft">{formatDate(tx.initiated_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="ys-card text-center py-8">
                <p className="text-sm text-ink-soft">No wallet found for this customer.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "Savings" && (
          <div className="space-y-3">
            {savingsAccounts.length === 0 ? (
              <div className="ys-card text-center py-8">
                <p className="text-sm text-ink-soft">No savings accounts.</p>
              </div>
            ) : savingsAccounts.map(sa => (
              <div key={sa.id} className="ys-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{sa.nickname || "Savings Account"}</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {sa.goal_enabled && `Goal: ${formatNaira(Number(sa.goal_amount) || 0)} · `}
                      Interest: {sa.interest_rate}% · Opened {sa.opened_at ? formatDate(sa.opened_at) : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-ink">{formatNaira(Number(sa.balance) || 0)}</p>
                    <StatusBadge status={sa.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Loans" && (
          <div className="space-y-3">
            {loans.length === 0 ? (
              <div className="ys-card text-center py-8">
                <p className="text-sm text-ink-soft">No loans.</p>
              </div>
            ) : loans.map(l => (
              <div key={l.id} className="ys-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">Loan · {l.duration_months} months</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Interest: {l.interest_rate}% · Monthly: {formatNaira(Number(l.monthly_repayment) || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-ink">{formatNaira(Number(l.outstanding_balance) || 0)}</p>
                    <StatusBadge status={l.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Transactions" && (
          <div className="ys-card">
            {recentTransactions.length === 0 ? (
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
                  {recentTransactions.map(tx => (
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
        )}

        {activeTab === "Audit Trail" && (
          <div className="ys-card">
            {timeline?.events.length === 0 ? (
              <p className="text-sm text-ink-soft py-4 text-center">No audit trail events.</p>
            ) : (
              <div className="space-y-3">
                {(timeline?.events || []).map((e, i) => (
                  <div key={`${e.id}-${i}`} className="flex gap-3 items-start py-2 border-b border-track/20 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-indigo mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-ink font-medium">{e.action}</p>
                      <p className="text-xs text-ink-soft">{e.entity_type || "—"} · {formatDateTime(e.timestamp)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.type === "admin" ? "bg-indigo/10 text-indigo" : "bg-parchment text-ink-soft"}`}>
                      {e.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action confirmation modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActionModal(null)}>
          <div className="bg-paper rounded-2xl border border-line p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-ink">{actionModal.label}</h3>
              <button onClick={() => setActionModal(null)} className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-ink-soft mb-3">
              You are about to {actionModal.label.toLowerCase()} <span className="font-medium text-ink">{customer.full_name}</span>. This action will be logged to the audit trail.
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason (required)…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20 resize-none"
            />
            {actionError && (
              <div className="mt-2 text-sm text-clay flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> {actionError}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setActionModal(null)} className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={!reason.trim() || actionLoading}
                className="flex-1 py-2.5 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 disabled:opacity-50 transition"
              >
                {actionLoading ? "Processing…" : `Confirm ${actionModal.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-soft uppercase tracking-wide">{label}</p>
      <p className={`text-sm text-ink mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
