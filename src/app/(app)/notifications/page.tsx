"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { LoadingState, ErrorState, Card, EmptyState, Button } from "@/components/yield";
import { Bell, CheckCheck, ArrowDownLeft, Shield, TrendingUp, PiggyBank, FileText } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

const categoryIcon: Record<string, typeof Bell> = {
  financial: ArrowDownLeft,
  savings: PiggyBank,
  loans: FileText,
  investments: TrendingUp,
  verification: Shield,
  auth: Shield,
  general: Bell,
};

export default function NotificationsPage() {
  const { data: me, isLoading: meLoading, error: meError } = useMe();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifData, isLoading } = useQuery<{ notifications: Notification[]; total: number }>({
    queryKey: ["notifications", filter],
    queryFn: async () => {
      const params = filter === "unread" ? "?read=false&limit=50" : "?limit=50";
      const res = await fetch(`/api/notifications${params}`);
      if (!res.ok) return { notifications: [], total: 0 };
      return res.json();
    },
    enabled: !!me,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (meLoading) return <LoadingState message="Loading notifications…" />;
  if (meError || !me) return <ErrorState message="Couldn't load notifications" />;

  const notifications = notifData?.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  if (notifications.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl text-ink">Notifications</h1>
          <p className="text-sm text-ink-soft">Stay updated on your account activity</p>
        </div>
        <EmptyState
          title="No notifications yet"
          message="You'll see notifications here when there's activity on your account."
          action={<Link href="/dashboard"><Button>Go to dashboard</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Notifications</h1>
          <p className="text-sm text-ink-soft">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="text-xs"
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
            filter === "all" ? "bg-indigo text-white" : "bg-parchment text-ink-soft"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
            filter === "unread" ? "bg-indigo text-white" : "bg-parchment text-ink-soft"
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {isLoading ? (
        <LoadingState message="Loading…" />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = categoryIcon[notif.category] || Bell;
            const isUnread = !notif.read;

            return (
              <Card
                key={notif.id}
                className={isUnread ? "border-indigo/30 bg-indigo/5" : ""}
              >
                <button
                  onClick={() => {
                    if (isUnread) markReadMutation.mutate(notif.id);
                  }}
                  className="flex items-start gap-3 w-full text-left"
                >
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUnread ? "bg-indigo/10" : "bg-parchment"
                  }`}>
                    <Icon className={`h-4 w-4 ${isUnread ? "text-indigo" : "text-ink-soft"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isUnread ? "font-semibold text-ink" : "font-medium text-ink-soft"}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">{notif.message}</p>
                    <p className="text-[11px] text-ink-soft mt-1">
                      {formatRelativeTime(notif.created_at)}
                    </p>
                  </div>
                  {isUnread && (
                    <div className="h-2 w-2 rounded-full bg-indigo flex-shrink-0 mt-2" />
                  )}
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
