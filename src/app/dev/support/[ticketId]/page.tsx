"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { ArrowLeft, Send, UserCheck, Play, Pause, CheckCircle, XCircle, RotateCcw, StickyNote } from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

interface Ticket {
  id: string;
  ticket_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_name: string | null;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
}
interface Message {
  id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
}

export default function TicketDetailPage({ params }: { params: { ticketId: string } }) {
  const { ticketId } = params;
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{ ticket: Ticket; messages: Message[] }>({
    queryKey: ["admin-ticket", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/support/${ticketId}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      return res.json();
    },
    staleTime: 10 * 1000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  const sendMessage = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/support/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply, is_internal_note: isInternal }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to send");
      }
      setReply("");
      await queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Action failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading ticket…" />;
  if (error || !data) return <ErrorState message="Couldn't load ticket" onRetry={() => refetch()} />;

  const { ticket, messages } = data;

  const actions = [
    { action: "assign", label: "Assign to me", icon: UserCheck, show: !ticket.assigned_name },
    { action: "start_progress", label: "Start", icon: Play, show: ticket.status === "open" || ticket.status === "assigned" },
    { action: "wait_customer", label: "Wait for customer", icon: Pause, show: ticket.status === "in_progress" },
    { action: "resolve", label: "Resolve", icon: CheckCircle, show: ticket.status !== "resolved" && ticket.status !== "closed" },
    { action: "close", label: "Close", icon: XCircle, show: ticket.status !== "closed" },
    { action: "reopen", label: "Reopen", icon: RotateCcw, show: ticket.status === "resolved" || ticket.status === "closed" },
  ].filter(a => a.show);

  return (
    <div className="space-y-6">
      <Link href="/dev/support" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition">
        <ArrowLeft className="h-4 w-4" /> Back to support desk
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-ink">{ticket.subject}</h1>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-ink-soft mt-1 font-mono">{ticket.ticket_number}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-soft">
            <span>Priority: <span className="font-medium text-ink">{ticket.priority}</span></span>
            <span>Category: <span className="font-medium text-ink">{ticket.category}</span></span>
            <span>Assigned: <span className="font-medium text-ink">{ticket.assigned_name || "Unassigned"}</span></span>
            <span>Created: <span className="font-medium text-ink">{formatRelativeTime(ticket.created_at)}</span></span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {actions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.action}
                onClick={() => handleAction(a.action)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-parchment disabled:opacity-50 transition"
              >
                <Icon className="h-4 w-4" /> {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <div className="bg-clay/10 text-clay text-sm rounded-lg p-3">{actionError}</div>
      )}

      {/* Customer info */}
      {(ticket.customer_name || ticket.customer_email || ticket.customer_phone) && (
        <div className="ys-card">
          <h3 className="text-sm font-medium text-ink mb-2">Customer Info</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-xs text-ink-soft">Name</p><p className="text-sm text-ink">{ticket.customer_name || "—"}</p></div>
            <div><p className="text-xs text-ink-soft">Email</p><p className="text-sm text-ink">{ticket.customer_email || "—"}</p></div>
            <div><p className="text-xs text-ink-soft">Phone</p><p className="text-sm text-ink">{ticket.customer_phone || "—"}</p></div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="ys-card">
        <h3 className="text-sm font-medium text-ink mb-4">Conversation</h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.is_internal_note ? "opacity-70" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                msg.sender_type === "staff" ? "bg-indigo text-white" :
                msg.sender_type === "system" ? "bg-parchment text-ink-soft" :
                "bg-ochre/20 text-ochre"
              }`}>
                {msg.sender_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{msg.sender_name}</span>
                  {msg.is_internal_note && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-ochre/10 text-ochre">Internal</span>
                  )}
                  <span className="text-xs text-ink-soft">{formatDateTime(msg.created_at)}</span>
                </div>
                <p className="text-sm text-ink mt-1 whitespace-pre-wrap">{msg.message}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply box */}
        <div className="mt-4 pt-4 border-t border-line">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type your reply…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-line bg-paper text-ink text-sm placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo/20 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
              <StickyNote className="h-4 w-4" /> Internal note
            </label>
            <button
              onClick={sendMessage}
              disabled={!reply.trim() || sending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo text-white text-sm font-medium hover:bg-indigo/90 disabled:opacity-50 transition"
            >
              <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
