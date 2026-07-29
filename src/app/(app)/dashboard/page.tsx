"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { LoadingState, ErrorState } from "@/components/yield";
import { formatRelativeTime, initials } from "@/lib/format";
import {
  PiggyBank, Landmark, Users, TrendingUp,
  Bell, Wallet, ArrowUpRight, ArrowDownLeft,
  Plus, Send, RefreshCw, Eye, EyeOff,
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
// Dashboard — Wallet-first layout
// Mobile: balance hero card → quick actions → activity
// Desktop: wallet hero spans left column → 4 metric cards →
//          recent activity | right rail (Loan eligibility, Invest promo)
// ════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { data: me, isLoading: meLoading, error: meError, refetch: refetchMe } = useMe();

  const walletId = me?.wallet?.id;
  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions?limit=8`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  if (meLoading) return <LoadingState message="Loading your dashboard…" />;
  if (meError || !me) return <ErrorState message="Couldn't load your dashboard" onRetry={() => refetchMe()} />;

  const wallet = me.wallet;
  const transactions = txData?.transactions || [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.profile.full_name?.split(" ")[0] || "there";

  return (
    <>
      {/* ══════════════════════════════════════════════
          MOBILE LAYOUT
         ══════════════════════════════════════════════ */}
      <div className="md:hidden space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-indigo flex items-center justify-center text-white font-display font-semibold text-sm">
              {initials(me.profile.full_name)}
            </div>
            <div>
              <p className="font-display font-semibold text-[16px] text-ink leading-tight">{me.profile.full_name}</p>
              <p className="text-[11px] text-ink-soft">{greeting}</p>
            </div>
          </div>
          <Link href="/notifications" className="h-9 w-9 rounded-full bg-ochre flex items-center justify-center">
            <Bell className="h-[18px] w-[18px] text-indigo-deep" strokeWidth={2} />
          </Link>
        </div>

        {/* ── Wallet hero card (mobile) ── */}
        <WalletHeroCard
          wallet={wallet}
          balanceVisible={balanceVisible}
          onToggleBalance={() => setBalanceVisible(!balanceVisible)}
        />

        {/* Quick actions grid */}
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={PiggyBank} label="Save" href="/savings" color="bg-indigo" />
          <QuickAction icon={Landmark} label="Borrow" href="/loans" color="bg-loam" />
          <QuickAction icon={Users} label="Co-op" href="/cooperative" color="bg-indigo-deep" />
          <QuickAction icon={TrendingUp} label="Invest" href="/investments" color="bg-loam-dim" />
        </div>

        {/* Promo */}
        <div className="bg-indigo-deep rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="font-display font-semibold text-[14px] text-white">Lock savings · 90 days</p>
            <p className="text-[12px] text-white/60 mt-0.5">Earn 11.2% p.a. on Harvest Lock</p>
          </div>
          <Link href="/savings" className="bg-ochre text-indigo-deep text-[13px] font-semibold px-3 py-1.5 rounded-lg">
            Open
          </Link>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display font-semibold text-[16px] text-ink">Recent activity</h2>
            <Link href="/statements" className="text-[14px] text-indigo font-medium">See all</Link>
          </div>
          <ActivityList transactions={transactions} loading={txLoading} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP LAYOUT
         ══════════════════════════════════════════════ */}
      <div className="hidden md:block space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="font-display font-bold text-[24px] text-ink">
            {greeting}, {firstName}
          </h1>
          <p className="text-[14px] text-ink-soft mt-1">
            Here&apos;s what&apos;s happening across your savings, loans and cooperative today.
          </p>
        </div>

        {/* ── WALLET HERO — full-width, replaces chart ── */}
        <WalletHeroCard
          wallet={wallet}
          balanceVisible={balanceVisible}
          onToggleBalance={() => setBalanceVisible(!balanceVisible)}
          desktop
        />

        {/* 4 metric cards */}
        <div className="grid grid-cols-4 gap-3">
          <MetricCard icon={Wallet} label="Total balance" value={wallet ? fmtNGN(wallet.available_balance) : "—"} delta="+3.4%" deltaUp />
          <MetricCard icon={PiggyBank} label="Locked savings" value="₦0" delta="No active lock" deltaUp />
          <MetricCard icon={TrendingUp} label="Contributions" value="₦0" delta="This month" deltaUp />
          <MetricCard icon={Landmark} label="Repayments" value="₦0" delta="Nothing due" deltaUp />
        </div>

        {/* Bottom two-col: activity + right rail */}
        <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
          {/* Left — recent activity */}
          <div className="bg-paper border border-line rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-semibold text-[17px] text-ink">Recent activity</h3>
              <Link href="/statements" className="text-[13px] text-indigo font-medium hover:underline">
                See all →
              </Link>
            </div>
            <ActivityList transactions={transactions} loading={txLoading} />
          </div>

          {/* Right — mini right rail inline (supplements the layout right rail) */}
          <div className="space-y-3">
            {/* Quick actions */}
            <div className="bg-paper border border-line rounded-2xl p-4">
              <h4 className="font-display font-semibold text-[14px] text-ink mb-3">Quick actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction icon={PiggyBank} label="Save" href="/savings" color="bg-indigo" />
                <QuickAction icon={Landmark} label="Borrow" href="/loans" color="bg-loam" />
                <QuickAction icon={Users} label="Co-op" href="/cooperative" color="bg-indigo-deep" />
                <QuickAction icon={TrendingUp} label="Invest" href="/investments" color="bg-loam-dim" />
              </div>
            </div>

            {/* Promo */}
            <div className="bg-indigo-deep rounded-2xl p-4">
              <p className="font-display font-semibold text-[14px] text-white mb-1">Lock savings · 90 days</p>
              <p className="text-[12px] text-white/60 mb-3">Earn 11.2% p.a. on Harvest Lock</p>
              <Link
                href="/savings"
                className="block text-center bg-ochre text-indigo-deep font-semibold text-[13px] py-2.5 rounded-xl"
              >
                Open account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Wallet Hero Card ────────────────────────────────────────
function WalletHeroCard({
  wallet,
  balanceVisible,
  onToggleBalance,
  desktop = false,
}: {
  wallet: { available_balance: number; ledger_balance: number; pending_balance: number; reserved_balance: number; account_number?: string | null } | null;
  balanceVisible: boolean;
  onToggleBalance: () => void;
  desktop?: boolean;
}) {
  return (
    <div className="relative bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl overflow-hidden text-white">
      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-paper/5 pointer-events-none" />
      <div className="absolute -right-4 -bottom-8 w-32 h-32 rounded-full bg-paper/5 pointer-events-none" />

      <div className={`relative p-5 ${desktop ? "pb-5" : "pb-4"}`}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-paper/15 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-ochre" />
            </div>
            <span className="text-[13px] text-white/80 font-medium">Agriqcap Wallet</span>
          </div>
          <button
            onClick={onToggleBalance}
            className="w-8 h-8 rounded-lg bg-paper/10 flex items-center justify-center hover:bg-paper/20 transition"
            aria-label="Toggle balance visibility"
          >
            {balanceVisible ? <EyeOff className="w-4 h-4 text-white/70" /> : <Eye className="w-4 h-4 text-white/70" />}
          </button>
        </div>

        {/* Balance */}
        <div className="mb-1">
          <p className="text-[12px] text-white/50 uppercase tracking-widest mb-1">Available Balance</p>
          <p className="font-mono font-medium leading-tight" style={{ fontSize: desktop ? "34px" : "30px" }}>
            {balanceVisible
              ? (wallet ? fmtNGN(wallet.available_balance) : "₦0")
              : "••••••"}
          </p>
        </div>

        {/* Account number */}
        {wallet?.account_number && (
          <p className="font-mono text-[12px] text-white/40 mb-4">
            •••• {wallet.account_number.slice(-4)}
          </p>
        )}

        {/* Sub-balances row */}
        <div className="grid grid-cols-3 gap-3 mb-5 bg-paper/8 rounded-xl p-3">
          <div>
            <p className="text-[12px] text-white/50 uppercase tracking-wider mb-0.5">Ledger</p>
            <p className="font-mono text-[13px] text-white font-medium">
              {balanceVisible ? (wallet ? fmtNGN(wallet.ledger_balance) : "₦0") : "••••"}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-white/50 uppercase tracking-wider mb-0.5">Pending</p>
            <p className="font-mono text-[13px] text-white font-medium">
              {balanceVisible ? (wallet ? fmtNGN(wallet.pending_balance) : "₦0") : "••••"}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-white/50 uppercase tracking-wider mb-0.5">Reserved</p>
            <p className="font-mono text-[13px] text-white font-medium">
              {balanceVisible ? (wallet ? fmtNGN(wallet.reserved_balance) : "₦0") : "••••"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/wallet/deposit"
            className="flex flex-col items-center gap-1.5 bg-ochre rounded-xl py-2.5 hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4 text-indigo-deep" strokeWidth={2.5} />
            <span className="text-[11px] font-semibold text-indigo-deep">Add money</span>
          </Link>
          <Link
            href="/wallet/transfer"
            className="flex flex-col items-center gap-1.5 bg-paper/15 rounded-xl py-2.5 hover:bg-paper/20 transition"
          >
            <Send className="w-4 h-4 text-white" strokeWidth={2} />
            <span className="text-[11px] font-medium text-white">Transfer</span>
          </Link>
          <Link
            href="/wallet"
            className="flex flex-col items-center gap-1.5 bg-paper/15 rounded-xl py-2.5 hover:bg-paper/20 transition"
          >
            <RefreshCw className="w-4 h-4 text-white" strokeWidth={2} />
            <span className="text-[11px] font-medium text-white">History</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Metric card (desktop) ───────────────────────────────────
function MetricCard({
  icon: Icon, label, value, delta, deltaUp,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
}) {
  return (
    <div className="bg-paper border border-line rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl bg-indigo flex items-center justify-center">
          <Icon className="w-[17px] h-[17px] text-white" strokeWidth={1.8} />
        </div>
      </div>
      <p className="text-[12px] text-ink-soft font-medium mb-1">{label}</p>
      <p className="font-mono font-semibold text-[22px] text-ink leading-tight">{value}</p>
      <p className={`text-[11px] mt-1 font-medium ${deltaUp ? "text-loam" : "text-clay"}`}>{delta}</p>
    </div>
  );
}

// ─── Quick action chip ───────────────────────────────────────
function QuickAction({
  icon: Icon, label, href, color,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5">
      <div className={`w-full aspect-square rounded-2xl ${color} flex items-center justify-center max-w-[52px] mx-auto`}>
        <Icon className="w-[20px] h-[20px] text-white" strokeWidth={1.8} />
      </div>
      <span className="text-[11px] font-medium text-ink-soft">{label}</span>
    </Link>
  );
}

// ─── Activity list ───────────────────────────────────────────
function ActivityList({
  transactions,
  loading,
}: {
  transactions: WalletTransaction[];
  loading: boolean;
}) {
  if (loading) return <LoadingState message="Loading activity…" />;
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-parchment flex items-center justify-center mx-auto mb-3">
          <Wallet className="w-6 h-6 text-ink-soft" strokeWidth={1.5} />
        </div>
        <p className="font-medium text-[14px] text-ink">No transactions yet</p>
        <p className="text-[12px] text-ink-soft mt-1">Your activity will appear here</p>
      </div>
    );
  }

  return (
    <div>
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-line last:border-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            tx.direction === "credit" ? "bg-loam" : "bg-clay"
          }`}>
            {tx.direction === "credit"
              ? <ArrowDownLeft className="w-5 h-5 text-white" strokeWidth={2} />
              : <ArrowUpRight className="w-5 h-5 text-white" strokeWidth={2} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[14px] text-ink capitalize leading-tight">
              {(tx.description || tx.transaction_type).replace(/_/g, " ")}
            </p>
            <p className="text-[12px] text-ink-soft mt-0.5">{formatRelativeTime(tx.created_at)}</p>
          </div>
          <div className="text-right">
            <p className={`font-mono font-semibold text-[14px] ${
              tx.direction === "credit" ? "text-loam" : "text-clay"
            }`}>
              {tx.direction === "credit" ? "+" : "−"}{fmtNGN(tx.amount)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
