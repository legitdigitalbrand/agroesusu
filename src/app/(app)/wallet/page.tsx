"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { Card, MoneyText, LoadingState, ErrorState, EmptyState, Button } from "@/components/yield";
import { formatRelativeTime } from "@/lib/format";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Link from "next/link";

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

export default function WalletPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const walletId = me?.wallet?.id;

  const { data: txData, isLoading: txLoading, error: txError, refetch } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  if (meLoading) return <LoadingState message="Loading wallet…" />;
  if (!me?.wallet) return (
    <EmptyState
      title="No wallet yet"
      message="Your wallet will be created automatically when you sign up."
      action={<Link href="/dashboard"><Button>Go to dashboard</Button></Link>}
    />
  );

  const wallet = me.wallet;
  const transactions = txData?.transactions || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Agriqcap Wallet</h1>
        <p className="text-sm text-ink-soft">Your digital wallet for all transactions</p>
      </div>

      {/* Balance card */}
      <Card variant="dark" className="relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-xs text-white/60 uppercase tracking-wide">Available Balance</p>
          <p className="mt-1 font-mono text-3xl text-white">
            {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(wallet.available_balance)}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white/50 text-xs">Ledger</p>
              <p className="font-mono text-white/80">
                {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(wallet.ledger_balance)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-xs">Pending</p>
              <p className="font-mono text-white/80">
                {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(wallet.pending_balance)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-xs">Reserved</p>
              <p className="font-mono text-white/80">
                {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(wallet.reserved_balance)}
              </p>
            </div>
          </div>
          {wallet.account_number && (
            <p className="mt-3 text-xs text-white/40">Account: {wallet.account_number}</p>
          )}
        </div>
      </Card>

      {/* Transactions */}
      <div>
        <h2 className="font-display text-lg text-ink mb-3">Transaction History</h2>
        {txLoading ? (
          <LoadingState message="Loading transactions…" />
        ) : txError ? (
          <ErrorState message="Couldn't load transactions" onRetry={() => refetch()} />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            message="Your wallet transactions will appear here once you start using Agriqcap."
          />
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-track/30 last:border-0">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.direction === "credit" ? "bg-loam/10" : "bg-clay/10"}`}>
                  {tx.direction === "credit" ? <ArrowDownLeft className="h-5 w-5 text-loam" /> : <ArrowUpRight className="h-5 w-5 text-clay" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink capitalize">{tx.transaction_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-ink-soft">{formatRelativeTime(tx.created_at)}</p>
                </div>
                <div className="text-right">
                  <MoneyText amount={tx.amount} direction={tx.direction} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
