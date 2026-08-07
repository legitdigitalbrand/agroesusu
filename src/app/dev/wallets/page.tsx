"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/yield";
import { Search, ChevronLeft, ChevronRight, Wallet as WalletIcon } from "lucide-react";
import { formatNaira, formatDate } from "@/lib/format";
import Link from "next/link";

interface Wallet {
  id: string;
  account_number: string | null;
  account_name: string | null;
  bank_name: string | null;
  balance: number;
  created_at: string;
  customer_name: string;
  customer_number: string;
  customer_status: string;
}

export default function AdminWalletsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery<{ wallets: Wallet[]; total: number }>({
    queryKey: ["admin-wallets", search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), skip: String(page * limit) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/wallets?${params}`);
      if (!res.ok) throw new Error("Failed to load wallets");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const wallets = data?.wallets || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Wallets</h1>
        <p className="text-sm text-ink-soft mt-0.5">Monitor and manage customer wallets</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by account number or name…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      {isLoading ? (
        <LoadingState message="Loading wallets…" />
      ) : error ? (
        <ErrorState message="Couldn't load wallets" onRetry={() => refetch()} />
      ) : wallets.length === 0 ? (
        <div className="ys-card text-center py-12">
          <WalletIcon className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No wallets found.</p>
        </div>
      ) : (
        <>
          <div className="ys-card overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-track/60">
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Account #</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Customer</th>
                  <th className="text-right text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Balance</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Bank</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map(w => (
                  <tr key={w.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 cursor-pointer transition">
                    <td className="py-3 pr-4 font-mono text-sm text-ink">
                      <Link href={`/dev/wallets/${w.id}`} className="hover:text-indigo">{w.account_number || "—"}</Link>
                    </td>
                    <td className="py-3 pr-4 text-sm text-ink font-medium">
                      <Link href={`/dev/wallets/${w.id}`} className="hover:text-indigo">{w.customer_name}</Link>
                    </td>
                    <td className="py-3 pr-4 text-sm text-right font-medium text-ink">{formatNaira(Number(w.balance) || 0)}</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">{w.bank_name || "—"}</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">{formatDate(w.created_at)}</td>
                  </tr>
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
