"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { Search, ChevronLeft, ChevronRight, Plus, Headphones, X } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import Link from "next/link";

interface Ticket {
  id: string;
  ticket_number: string;
  customer_name: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_TABS = ["all", "open", "assigned", "in_progress", "waiting_customer", "resolved", "closed"] as const;

export default function AdminSupportPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const limit = 20;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{ tickets: Ticket[]; total: number }>({
    queryKey: ["admin-support", search, tab, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), skip: String(page * limit) });
      if (search) params.set("search", search);
      if (tab !== "all") params.set("status", tab);
      const res = await fetch(`/api/admin/support?${params}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const tickets = data?.tickets || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Support Desk</h1>
          <p className="text-sm text-ink-soft mt-0.5">Manage customer support tickets</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 transition"
        >
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by subject, ticket #, customer name…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      {isLoading ? (
        <LoadingState message="Loading tickets…" />
      ) : error ? (
        <ErrorState message="Couldn't load tickets" onRetry={() => refetch()} />
      ) : tickets.length === 0 ? (
        <div className="ys-card text-center py-12">
          <Headphones className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No tickets found.</p>
        </div>
      ) : (
        <>
          <div className="ys-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-track/60">
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Ticket #</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Subject</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Customer</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Priority</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Assigned</th>
                  <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 cursor-pointer transition">
                    <td className="py-3 pr-4 font-mono text-sm text-ink">
                      <Link href={`/dev/support/${t.id}`} className="hover:text-indigo">{t.ticket_number}</Link>
                    </td>
                    <td className="py-3 pr-4 text-sm text-ink font-medium">
                      <Link href={`/dev/support/${t.id}`} className="hover:text-indigo">{t.subject}</Link>
                    </td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">{t.customer_name || "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.priority === 'urgent' ? 'bg-clay/10 text-clay' :
                        t.priority === 'high' ? 'bg-ochre/10 text-ochre' :
                        t.priority === 'medium' ? 'bg-indigo/10 text-indigo' :
                        'bg-parchment text-ink-soft'
                      }`}>{t.priority}</span>
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={t.status} /></td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">{t.assigned_name || "Unassigned"}</td>
                    <td className="py-3 text-sm text-ink-soft">{formatRelativeTime(t.created_at)}</td>
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

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ["admin-support"] }); }} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
          customer_name: customerName.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create ticket");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-paper rounded-2xl border border-line p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-ink">New Support Ticket</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" rows={4} className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 resize-none" />
          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)" className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20" />
          <div className="flex gap-3">
            <select value={category} onChange={e => setCategory(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20">
              <option value="general">General</option>
              <option value="account">Account</option>
              <option value="transaction">Transaction</option>
              <option value="loan">Loan</option>
              <option value="savings">Savings</option>
              <option value="complaint">Complaint</option>
              <option value="fraud">Fraud</option>
              <option value="technical">Technical</option>
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {error && <p className="text-sm text-clay">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment transition">Cancel</button>
            <button onClick={handleCreate} disabled={!subject.trim() || !description.trim() || loading} className="flex-1 py-2.5 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 disabled:opacity-50 transition">
              {loading ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
