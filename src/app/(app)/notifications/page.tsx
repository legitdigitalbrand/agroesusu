"use client";

import { Card, EmptyState, Button } from "@/components/yield";
import { CheckCircle, TrendingUp, Landmark } from "lucide-react";
import Link from "next/link";

export default function NotificationsPage() {
  // TODO: Wire to notifications API
  const notifications: Array<{
    id: string;
    type: "welcome" | "savings" | "loan" | "investment";
    title: string;
    message: string;
    time: string;
    read: boolean;
  }> = [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">Notifications</h1>
        <p className="text-sm text-ink-soft">Stay updated on your account activity</p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          message="You'll see notifications here when there's activity on your account."
          action={<Link href="/dashboard"><Button>Go to dashboard</Button></Link>}
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={n.read ? "" : "border-indigo/30 bg-parchment"}>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-parchment flex items-center justify-center flex-shrink-0">
                  {n.type === "welcome" && <CheckCircle className="h-4 w-4 text-loam" />}
                  {n.type === "savings" && <TrendingUp className="h-4 w-4 text-indigo" />}
                  {n.type === "loan" && <Landmark className="h-4 w-4 text-indigo" />}
                  {n.type === "investment" && <TrendingUp className="h-4 w-4 text-loam" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  <p className="text-xs text-ink-soft mt-0.5">{n.message}</p>
                  <p className="text-xs text-ink-soft mt-1">{n.time}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-indigo flex-shrink-0 mt-2" />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
