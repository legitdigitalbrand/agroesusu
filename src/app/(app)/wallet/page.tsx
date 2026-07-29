"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { LoadingState, ErrorState, EmptyState } from "@/components/yield";
import { formatRelativeTime } from "@/lib/format";
import {
  ArrowUpRight, ArrowDownLeft, Plus, Send, RefreshCw,
  Copy, Eye, EyeOff, Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(v || 0);

// ════════════════════════════════════════════════════════════
// Wallet Page — wallet is the hero element
// Large balance card, 4D balance breakdown, action buttons,
// transaction history with direction icons
// ════════════════════════════════════════════════════════════

export default function WalletPage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const { data: me, isLoading: meLoading } = useMe();
  const walletId = me?.wallet?.id;

  const { data: txData, isLoading: txLoading, error: txError, refetch } = useQuery<{
    transactions: WalletTransaction[];
  }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  if (meLoading) return <LoadingState message="Loading wallet…" />;
  if (!me?.wallet) {
    return (
      <EmptyState
        title="No wallet yet"
        message="Your wallet will be created automatically when you complete sign-up."
        action={<Link href="/dashboard" className="bg-indigo text-white text-sm font-medium px-4 py-2 rounded-lg inline-block">Go to dashboard</Link>}
      />
    );
  }

  const wallet = me.wallet;
  const transactions = txData?.transactions || [];

  const copyAccountNumber = () => {
    if (wallet.account_number) {
      navigator.clipboard.writeText(wallet.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Page title */}
      <div>
        <h1 className="font-display font-bold text-[22px] text-ink">Wallet</h1>
        <p className="text-[13px] text-ink-soft mt-0.5">Your Agriqcap digital wallet</p>
      </div>

      {/* ── HERO BALANCE CARD ── */}
      <div className="relative bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl overflow-hidden text-white">
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-paper/5 pointer-events-none" />
        <div className="absolute right-10 bottom-0 w-28 h-28 rounded-full bg-paper/5 pointer-events-none" />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-paper/15 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-ochre" />
              </div>
              <span className="text-[13px] text-white/70 font-medium">Agriqcap Wallet</span>
            </div>
            <button
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="w-8 h-8 rounded-lg bg-paper/10 flex items-center justify-center hover:bg-paper/20 transition"
              aria-label="Toggle balance"
            >
              {balanceVisible
                ? <EyeOff className="w-4 h-4 text-white/70" />
                : <Eye className="w-4 h-4 text-white/70" />
              }
            </button>
          </div>

          {/* Available balance — LARGE */}
          <div className="mb-2">
            <p className="text-[11px] text-white/50 uppercase tracking-widest mb-1.5">Available Balance</p>
            <p className="font-mono font-semibold text-[38px] leading-tight">
              {balanceVisible ? fmtNGN(wallet.available_balance) : "₦••••••"}
            </p>
          </div>

          {/* Account number with copy */}
          {wallet.account_number && (
            <button
              onClick={copyAccountNumber}
              className="flex items-center gap-1.5 mb-5 group"
              aria-label="Copy account number"
            >
              <span className="font-mono text-[13px] text-white/50 group-hover:text-white/70 transition">
                {wallet.account_number}
              </span>
              <Copy className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60 transition" />
              {copied && (
                <span className="text-[11px] text-ochre ml-1">Copied!</span>
              )}
            </button>
          )}

          {/* 4D balance breakdown */}
          <div className="grid grid-cols-3 gap-3 bg-paper/8 rounded-xl p-4 mb-5">
            <div>
              <p className="text-[12px] text-white/50 uppercase tracking-wider mb-1">Ledger</p>
              <p className="font-mono font-medium text-[14px] text-white">
                {balanceVisible ? fmtNGN(wallet.ledger_balance) : "••••"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-white/50 uppercase tracking-wider mb-1">Pending</p>
              <p className="font-mono font-medium text-[14px] text-white">
                {balanceVisible ? fmtNGN(wallet.pending_balance) : "••••"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-white/50 uppercase tracking-wider mb-1">Reserved</p>
              <p className="font-mono font-medium text-[14px] text-white">
                {balanceVisible ? fmtNGN(wallet.reserved_balance) : "••••"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/wallet/deposit"
              className="flex items-center justify-center gap-2 bg-ochre py-3 rounded-xl hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4 text-indigo-deep" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-indigo-deep">Add money</span>
            </Link>
            <Link
              href="/wallet/transfer"
              className="flex items-center justify-center gap-2 bg-paper/15 py-3 rounded-xl hover:bg-paper/20 transition"
            >
              <Send className="w-4 h-4 text-white" strokeWidth={2} />
              <span className="text-[13px] font-medium text-white">Transfer</span>
            </Link>
            <Link
              href="/wallet/withdraw"
              className="flex items-center justify-center gap-2 bg-paper/15 py-3 rounded-xl hover:bg-paper/20 transition"
            >
              <ArrowUpRight className="w-4 h-4 text-white" strokeWidth={2} />
              <span className="text-[13px] font-medium text-white">Withdraw</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── TRANSACTION HISTORY ── */}
      <div className="bg-paper border border-line rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display font-semibold text-[17px] text-ink">Transaction History</h2>
          <span className="text-[12px] text-ink-soft">{transactions.length} entries</span>
        </div>

        {txLoading ? (
          <LoadingState message="Loading transactions…" />
        ) : txError ? (
          <ErrorState message="Couldn't load transactions" onRetry={() => refetch()} />
        ) : transactions.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-parchment flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="w-7 h-7 text-ink-soft" strokeWidth={1.5} />
            </div>
            <p className="font-medium text-[15px] text-ink mb-1">No transactions yet</p>
            <p className="text-[13px] text-ink-soft">Your wallet transactions will appear here once you start using Agriqcap.</p>
          </div>
        ) : (
          <div>
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-3.5 border-b border-line last:border-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  tx.direction === "credit" ? "bg-loam" : "bg-clay"
                }`}>
                  {tx.direction === "credit"
                    ? <ArrowDownLeft className="w-5 h-5 text-white" strokeWidth={2} />
                    : <ArrowUpRight className="w-5 h-5 text-white" strokeWidth={2} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[14px] text-ink capitalize leading-snug">
                    {(tx.description || tx.transaction_type).replace(/_/g, " ")}
                  </p>
                  <p className="text-[12px] text-ink-soft mt-0.5">
                    {formatRelativeTime(tx.created_at)} · <span className="capitalize">{tx.status}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-mono font-semibold text-[15px] ${
                    tx.direction === "credit" ? "text-loam" : "text-clay"
                  }`}>
                    {tx.direction === "credit" ? "+" : "−"}{fmtNGN(tx.amount)}
                  </p>
                  <p className="text-[12px] text-ink-soft mt-0.5 uppercase tracking-wider">
                    {tx.transaction_type.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
