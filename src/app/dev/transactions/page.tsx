"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download, Receipt } from "lucide-react";
import { formatNaira, formatDateTime } from "@/lib/format";

interface Transaction {
  id: string;
  transaction_reference: string;
  transaction_type: string;
  source_module: string;
  source_reference: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  wallet_id: string | null;
  journal_entry_id: string | null;
  correlation_id: string;
  metadata: Record<string, unknown>;
  reverses: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  validation_errors: Record<string, unknown> | null;
  initiated_at: string;
  validated_at: string | null;
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "wallet_deposit", label: "Wallet Deposit" },
  { value: "wallet_withdrawal", label: "Wallet Withdrawal" },
  { value: "wallet_transfer", label: "Wallet Transfer" },
  { value: "savings_contribution", label: "Savings Contribution" },
  { value: "savings_withdrawal", label: "Savings Withdrawal" },
  { value: "savings_interest", label: "Savings Interest" },
  { value: "loan_disbursement", label: "Loan Disbursement" },
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "loan_interest", label: "Loan Interest" },
  { value: "loan_penalty", label: "Loan Penalty" },
  { value: "investment_subscription", label: "Investment Subscription" },
  { value: "investment_redemption", label: "Investment Redemption" },
  { value: "investment_returns", label: "Investment Returns" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "initiated", label: "Initiated" },
  { value: "validated", label: "Validated" },
  { value: "posted", label: "Posted" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "reversed", label: "Reversed" },
];

export default function AdminTransactionsPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;

  const { data, isLoading, error, refetch } = useQuery<{ transactions: Transaction[]; total: number }>({
    queryKey: ["admin-transactions", search, type, status, dateFrom, dateTo, minAmount, maxAmount, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), skip: String(page * limit) });
      if (search) params.set("search", search);
      if (type !== "all") params.set("type", type);
      if (status !== "all") params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (minAmount) params.set("min_amount", minAmount);
      if (maxAmount) params.set("max_amount", maxAmount);
      const res = await fetch(`/api/admin/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ["Reference", "Type", "Amount", "Currency", "Status", "Description", "Source Module", "Date"];
    const rows = transactions.map(t => [
      t.transaction_reference, t.transaction_type, t.amount, t.currency, t.status,
      `"${t.description || ''}"`, t.source_module, t.initiated_at,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Transactions</h1>
        <p className="text-sm text-ink-soft mt-0.5">Universal transaction explorer</p>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by reference…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <select value={type} onChange={e => { setType(e.target.value); setPage(0); }} className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20">
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20" />
        <input type="number" value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(0); }} placeholder="Min amount" className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20" />
        <input type="number" value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(0); }} placeholder="Max amount" className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20" />
      </div>

      <div className="flex justify-end">
        <button onClick={exportCSV} disabled={transactions.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment disabled:opacity-40 transition">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {isLoading ? (
        <LoadingState message="Loading transactions…" />
      ) : error ? (
        <ErrorState message="Couldn't load transactions" onRetry={() => refetch()} />
      ) : transactions.length === 0 ? (
        <div className="ys-card text-center py-12">
          <Receipt className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No transactions found.</p>
        </div>
      ) : (
        <>
          <div className="ys-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-track/60">
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Reference</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Type</th>
                  <th className="text-right text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Amount</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Description</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <>
                    <tr
                      key={tx.id}
                      onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                      className="border-b border-track/30 last:border-0 hover:bg-parchment/50 cursor-pointer transition"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-ink">
                        {tx.transaction_reference}
                        {expandedId === tx.id ? <ChevronUp className="inline ml-1 h-3 w-3" /> : <ChevronDown className="inline ml-1 h-3 w-3" />}
                      </td>
                      <td className="py-3 pr-4 text-sm text-ink">{tx.transaction_type}</td>
                      <td className="py-3 pr-4 text-sm text-right font-medium text-ink">{formatNaira(Number(tx.amount) || 0)}</td>
                      <td className="py-3 pr-4"><StatusBadge status={tx.status} /></td>
                      <td className="py-3 pr-4 text-sm text-ink-soft truncate max-w-[200px]">{tx.description || "—"}</td>
                      <td className="py-3 text-sm text-ink-soft">{formatDateTime(tx.initiated_at)}</td>
                    </tr>
                    {expandedId === tx.id && (
                      <tr key={`${tx.id}-detail`} className="bg-parchment/30">
                        <td colSpan={6} className="px-4 pb-4 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div><p className="text-xs text-ink-soft uppercase">Source Module</p><p className="text-ink">{tx.source_module}</p></div>
                            <div><p className="text-xs text-ink-soft uppercase">Source Reference</p><p className="text-ink font-mono">{tx.source_reference}</p></div>
                            <div><p className="text-xs text-ink-soft uppercase">Correlation ID</p><p className="text-ink font-mono text-xs">{tx.correlation_id}</p></div>
                            <div><p className="text-xs text-ink-soft uppercase">Journal Entry</p><p className="text-ink font-mono text-xs">{tx.journal_entry_id || "—"}</p></div>
                            <div><p className="text-xs text-ink-soft uppercase">Wallet ID</p><p className="text-ink font-mono text-xs">{tx.wallet_id || "—"}</p></div>
                            <div><p className="text-xs text-ink-soft uppercase">Validated At</p><p className="text-ink">{tx.validated_at ? formatDateTime(tx.validated_at) : "—"}</p></div>
                            {tx.reversal_reason && (
                              <div><p className="text-xs text-ink-soft uppercase">Reversal Reason</p><p className="text-clay">{tx.reversal_reason}</p></div>
                            )}
                            {tx.validation_errors && (
                              <div className="sm:col-span-3">
                                <p className="text-xs text-ink-soft uppercase">Validation Errors</p>
                                <pre className="text-xs text-clay mt-1 bg-clay-light/20 p-2 rounded overflow-x-auto">{JSON.stringify(tx.validation_errors, null, 2)}</pre>
                              </div>
                            )}
                            {tx.metadata && Object.keys(tx.metadata).length > 0 && (
                              <div className="sm:col-span-3">
                                <p className="text-xs text-ink-soft uppercase">Metadata</p>
                                <pre className="text-xs text-ink-soft mt-1 bg-parchment p-2 rounded overflow-x-auto">{JSON.stringify(tx.metadata, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

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
    </div>
  );
}
