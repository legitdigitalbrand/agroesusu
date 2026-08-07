"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { Search, ChevronLeft, ChevronRight, UserSearch } from "lucide-react";
import { formatDate } from "@/lib/format";
import Link from "next/link";

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
  created_at: string;
}

const STATUS_OPTIONS = ["all", "active", "registered", "suspended", "dormant", "closed"];

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery<{ customers: Customer[]; total: number }>({
    queryKey: ["admin-customers", search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(limit),
        skip: String(page * limit),
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/customers?${params}`);
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const customers = data?.customers || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Customers</h1>
        <p className="text-sm text-ink-soft mt-0.5">Search and manage all customer accounts</p>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, phone, email, customer number…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState message="Loading customers…" />
      ) : error ? (
        <ErrorState message="Couldn't load customers" onRetry={() => refetch()} />
      ) : customers.length === 0 ? (
        <div className="ys-card text-center py-12">
          <UserSearch className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No customers found.</p>
        </div>
      ) : (
        <>
          <div className="ys-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-track/60">
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Customer #</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Name</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Email</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Phone</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">BVN</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-track/30 last:border-0 hover:bg-parchment/50 cursor-pointer transition"
                  >
                    <td className="py-3 pr-4 font-mono text-sm text-ink">
                      <Link href={`/dev/customers/${c.id}`} className="hover:text-indigo">{c.customer_number}</Link>
                    </td>
                    <td className="py-3 pr-4 text-sm text-ink font-medium">
                      <Link href={`/dev/customers/${c.id}`} className="hover:text-indigo">{c.full_name}</Link>
                    </td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">{c.email || "—"}</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">{c.phone || "—"}</td>
                    <td className="py-3 pr-4 text-sm font-mono text-ink-soft">{c.bvn || "—"}</td>
                    <td className="py-3 pr-4"><StatusBadge status={c.status} /></td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">{c.registration_date ? formatDate(c.registration_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-line text-ink disabled:opacity-40 hover:bg-parchment transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-line text-ink disabled:opacity-40 hover:bg-parchment transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
