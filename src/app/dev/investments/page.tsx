"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { TrendingUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { formatNaira, formatRelativeTime } from "@/lib/format";

interface InvestmentProduct {
  id: string;
  product_code: string;
  name: string;
  description: string | null;
  return_rate: number;
  return_type: string;
  risk_level: string;
  status: string;
  minimum_amount: number;
  maximum_amount: number | null;
  duration_days: number;
  created_at: string;
}

interface InvestmentAccount {
  id: string;
  product_name: string;
  customer_name: string;
  principal_amount: number;
  current_value: number;
  status: string;
  start_date: string;
  maturity_date: string;
}

export default function AdminInvestmentsPage() {
  const [tab, setTab] = useState<"products" | "accounts">("products");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: productsData, isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery<{ products: InvestmentProduct[] }>({
    queryKey: ["admin-investment-products"],
    queryFn: async () => {
      const res = await fetch("/api/investments/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
    enabled: tab === "products",
  });

  const { data: accountsData, isLoading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useQuery<{ accounts: InvestmentAccount[]; total: number }>({
    queryKey: ["admin-investment-accounts", search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), skip: String(page * limit) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/reports?type=investments&${params}`);
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
    enabled: tab === "accounts",
  });

  const products = productsData?.products || [];
  const accounts = accountsData?.accounts || [];
  const total = accountsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Compute AUM
  const aum = products.reduce((sum, p) => sum + (p.minimum_amount || 0), 0);
  const activeProducts = products.filter(p => p.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Investments</h1>
        <p className="text-sm text-ink-soft mt-0.5">Manage investment products and monitor portfolio performance</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Products" value={String(products.length)} />
        <StatCard label="Active Products" value={String(activeProducts)} />
        <StatCard label="Total AUM" value={formatNaira(aum)} />
        <StatCard label="Avg Return" value={`${(products.reduce((s, p) => s + p.return_rate, 0) / (products.length || 1)).toFixed(1)}%`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        <button onClick={() => setTab("products")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === "products" ? "border-indigo text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}>Products</button>
        <button onClick={() => setTab("accounts")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === "accounts" ? "border-indigo text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}>Accounts</button>
      </div>

      {tab === "products" ? (
        productsLoading ? (
          <LoadingState message="Loading investment products…" />
        ) : productsError ? (
          <ErrorState message="Couldn't load products" onRetry={() => refetchProducts()} />
        ) : products.length === 0 ? (
          <div className="ys-card text-center py-12"><TrendingUp className="h-8 w-8 text-ink-soft mx-auto" /><p className="mt-3 text-sm text-ink-soft">No investment products configured.</p></div>
        ) : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className="ys-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-parchment flex items-center justify-center shrink-0">
                      <TrendingUp className="h-5 w-5 text-loam" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-ink-soft font-mono">{p.product_code}</p>
                      {p.description && <p className="text-xs text-ink-soft mt-1">{p.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-soft">
                        <span>Return: <span className="font-medium text-loam">{p.return_rate}% {p.return_type}</span></span>
                        <span>Risk: <span className="font-medium text-ink">{p.risk_level}</span></span>
                        <span>Min: <span className="font-medium text-ink">{formatNaira(p.minimum_amount)}</span></span>
                        {p.maximum_amount && <span>Max: <span className="font-medium text-ink">{formatNaira(p.maximum_amount)}</span></span>}
                        <span>Duration: <span className="font-medium text-ink">{p.duration_days} days</span></span>
                        <span>{formatRelativeTime(p.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by customer or product…" className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20" />
          </div>
          {accountsLoading ? (
            <LoadingState message="Loading accounts…" />
          ) : accountsError ? (
            <ErrorState message="Couldn't load accounts" onRetry={() => refetchAccounts()} />
          ) : accounts.length === 0 ? (
            <div className="ys-card text-center py-12"><p className="text-sm text-ink-soft">No investment accounts found.</p></div>
          ) : (
            <>
              <div className="ys-card overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-track/60">
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Customer</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Product</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Principal</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Current Value</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                      <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Maturity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                        <td className="py-3 pr-4 text-sm font-medium text-ink">{a.customer_name || "—"}</td>
                        <td className="py-3 pr-4 text-sm text-ink-soft">{a.product_name}</td>
                        <td className="py-3 pr-4 text-sm text-ink">{formatNaira(a.principal_amount)}</td>
                        <td className="py-3 pr-4 text-sm font-medium text-loam">{formatNaira(a.current_value)}</td>
                        <td className="py-3 pr-4"><StatusBadge status={a.status} /></td>
                        <td className="py-3 text-sm text-ink-soft">{a.maturity_date ? new Date(a.maturity_date).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-soft">Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 rounded-lg border border-line text-ink disabled:opacity-40 hover:bg-parchment transition"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} className="p-2 rounded-lg border border-line text-ink disabled:opacity-40 hover:bg-parchment transition"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </>
          )}
        </>
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
