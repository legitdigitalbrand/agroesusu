"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { LoadingState, ErrorState, Card, EmptyState, Button } from "@/components/yield";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

// ════════════════════════════════════════════════════════════
// Notifications — derived from recent wallet transactions
// Shows recent activity as notifications
// ════════════════════════════════════════════════════════════

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  direction: "credit" | "debit";
  status: string;
  description: string | null;
  reference: string;
  created_at: string;
}

const fmtNGN = (v: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(v || 0);

export default function NotificationsPage() {
  const { data: me, isLoading: meLoading, error: meError } = useMe();
  const walletId = me?.wallet?.id;

  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions-notif", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions?limit=20`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  if (meLoading) return <LoadingState message="Loading notifications…" />;
  if (meError || !me) return <ErrorState message="Couldn't load notifications" />;

  const transactions = txData?.transactions || [];

  if (!walletId || transactions.length === 0) {
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
      <div>
        <h1 className="font-display text-2xl text-ink">Notifications</h1>
        <p className="text-sm text-ink-soft">Stay updated on your account activity</p>
      </div>

      {txLoading ? (
        <LoadingState message="Loading…" />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const isCredit = tx.direction === "credit";
            const isPending = tx.status === "pending" || tx.status === "processing";

            return (
              <Card key={tx.id} className={isPending ? "border-ochre/40 bg-parchment" : ""}>
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCredit ? "bg-loam-light" : "bg-parchment"
                  }`}>
                    {isCredit ? (
                      <ArrowDownLeft className="h-4 w-4 text-loam" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-ink-soft" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {tx.description || tx.transaction_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {isCredit ? "+" : "-"}{fmtNGN(tx.amount)} · {tx.status}
                    </p>
                    <p className="text-xs text-ink-soft mt-1">
                      {formatRelativeTime(tx.created_at)}
                    </p>
                  </div>
                  {isPending && (
                    <div className="h-2 w-2 rounded-full bg-ochre flex-shrink-0 mt-2" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
