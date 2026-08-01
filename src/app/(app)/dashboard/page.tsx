"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { LoadingState, ErrorState } from "@/components/yield";
import { OnboardingChecklist } from "@/components/app/onboarding-checklist";
import { formatRelativeTime, initials } from "@/lib/format";
import {
  PiggyBank, Landmark,
  Bell, Wallet, ArrowUpRight, ArrowDownLeft,
  Plus, Send, RefreshCw, Eye, EyeOff, FileText,
  ChevronRight,
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
// Dashboard — Customer Journey Layout
//
// The dashboard guides users through their financial journey:
//   1. Onboarding checklist (shows until all steps complete)
//   2. Wallet hero card (balance + actions)
//   3. Quick actions (Fund, Save, Borrow, Statements)
//   4. Savings & Loans summaries with helpful empty states
//   5. Recent activity
//
// Every empty state explains WHY it matters and WHAT to do next.
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

  const savingsTotal = me?.summaries?.savings?.total_balance || 0;
  const savingsCount = me?.summaries?.savings?.count || 0;
  const loanTotal = me?.summaries?.loans?.total_outstanding || 0;
  const loanCount = me?.summaries?.loans?.count || 0;
  const hasKyc = (me.profile?.kyc_level || 0) >= 1;

  return (
    <>
      {/* ══════════════════════════════════════════════
          MOBILE LAYOUT
         ══════════════════════════════════════════════ */}
      <div className="md:hidden space-y-4">
        {/* Greeting */}
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

        {/* Onboarding checklist — guides users through their journey */}
        <OnboardingChecklist />

        {/* Wallet hero card */}
        <WalletHeroCard
          wallet={wallet}
          balanceVisible={balanceVisible}
          onToggleBalance={() => setBalanceVisible(!balanceVisible)}
        />

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          <QuickAction icon={Plus} label="Fund Wallet" href="/wallet/deposit" color="bg-indigo" />
          <QuickAction icon={PiggyBank} label="Open Savings" href="/savings" color="bg-loam" />
          <QuickAction icon={Landmark} label="Check Loans" href="/loans" color="bg-indigo-deep" />
          <QuickAction icon={FileText} label="Statements" href="/statements" color="bg-loam-dim" />
        </div>

        {/* Savings summary card */}
        <SavingsSummaryCard total={savingsTotal} count={savingsCount} />

        {/* Loans summary card */}
        <LoanSummaryCard total={loanTotal} count={loanCount} hasKyc={hasKyc} />

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
            Here&apos;s what&apos;s happening with your money today.
          </p>
        </div>

        {/* Onboarding checklist */}
        <OnboardingChecklist />

        {/* Wallet hero */}
        <WalletHeroCard
          wallet={wallet}
          balanceVisible={balanceVisible}
          onToggleBalance={() => setBalanceVisible(!balanceVisible)}
          desktop
        />

        {/* Savings + Loans side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SavingsSummaryCard total={savingsTotal} count={savingsCount} />
          <LoanSummaryCard total={loanTotal} count={loanCount} hasKyc={hasKyc} />
        </div>

        {/* Bottom: activity + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
          <div className="bg-paper border border-line rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-semibold text-[17px] text-ink">Recent activity</h3>
              <Link href="/statements" className="text-[13px] text-indigo font-medium hover:underline">
                See all →
              </Link>
            </div>
            <ActivityList transactions={transactions} loading={txLoading} />
          </div>

          <div className="space-y-3">
            <div className="bg-paper border border-line rounded-2xl p-4">
              <h4 className="font-display font-semibold text-[14px] text-ink mb-3">Quick actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction icon={Plus} label="Fund Wallet" href="/wallet/deposit" color="bg-indigo" />
                <QuickAction icon={PiggyBank} label="Open Savings" href="/savings" color="bg-loam" />
                <QuickAction icon={Landmark} label="Check Loans" href="/loans" color="bg-indigo-deep" />
                <QuickAction icon={FileText} label="Statements" href="/statements" color="bg-loam-dim" />
              </div>
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
  if (!wallet || wallet.available_balance === 0) {
    return (
      <div className="relative bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl overflow-hidden text-white">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-paper/5 pointer-events-none" />
        <div className="absolute -right-4 -bottom-8 w-32 h-32 rounded-full bg-paper/5 pointer-events-none" />
        <div className="relative p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-paper/15 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-ochre" />
              </div>
              <span className="text-[13px] text-white/80 font-medium">Agriqcap Wallet</span>
            </div>
          </div>
          <p className="text-[12px] text-white/70 mb-1">Available balance</p>
          <p className="font-mono font-bold text-[32px] leading-tight">
            {balanceVisible ? fmtNGN(wallet?.available_balance || 0) : "₦ ••••••"}
          </p>
          {/* Empty state with guidance */}
          <div className="mt-3 mb-4 bg-paper/10 rounded-xl p-3">
            <p className="text-[13px] text-white/90 font-medium mb-1">Your wallet is empty</p>
            <p className="text-[12px] text-white/70">
              Fund your wallet to start saving and unlock loan eligibility. You&apos;ll need at least ₦1,000.
            </p>
          </div>
          <Link
            href="/wallet/deposit"
            className="flex items-center justify-center gap-2 bg-ochre py-3 rounded-xl hover:opacity-90 transition w-full"
          >
            <Plus className="w-4 h-4 text-indigo-deep" strokeWidth={2.5} />
            <span className="text-[13px] font-semibold text-indigo-deep">Fund your wallet</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl overflow-hidden text-white">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-paper/5 pointer-events-none" />
      <div className="absolute -right-4 -bottom-8 w-32 h-32 rounded-full bg-paper/5 pointer-events-none" />
      <div className={`relative p-5 ${desktop ? "pb-5" : "pb-4"}`}>
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
        <p className="text-[12px] text-white/70 mb-1">Available balance</p>
        <p className="font-mono font-bold text-[32px] leading-tight">
          {balanceVisible ? fmtNGN(wallet?.available_balance || 0) : "₦ ••••••"}
        </p>
        <div className="flex gap-4 mt-2">
          <div>
            <p className="text-[10px] text-white/60">Ledger</p>
            <p className="font-mono text-[13px] text-white/90">{balanceVisible ? fmtNGN(wallet?.ledger_balance || 0) : "••••"}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/60">Pending</p>
            <p className="font-mono text-[13px] text-white/90">{balanceVisible ? fmtNGN(wallet?.pending_balance || 0) : "••••"}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Link href="/wallet/deposit" className="flex flex-col items-center gap-1.5 bg-ochre rounded-xl py-2.5 px-3 flex-1 hover:opacity-90 transition">
            <Plus className="w-4 h-4 text-indigo-deep" strokeWidth={2.5} />
            <span className="text-[11px] font-semibold text-indigo-deep">Add money</span>
          </Link>
          <Link href="/wallet/withdraw" className="flex flex-col items-center gap-1.5 bg-paper/15 rounded-xl py-2.5 px-3 flex-1 hover:bg-paper/20 transition">
            <Send className="w-4 h-4 text-white" strokeWidth={2} />
            <span className="text-[11px] font-medium text-white">Withdraw</span>
          </Link>
          <Link href="/wallet" className="flex flex-col items-center gap-1.5 bg-paper/15 rounded-xl py-2.5 px-3 flex-1 hover:bg-paper/20 transition">
            <RefreshCw className="w-4 h-4 text-white" strokeWidth={2} />
            <span className="text-[11px] font-medium text-white">History</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Savings Summary Card — with helpful empty state ───────
function SavingsSummaryCard({ total, count }: { total: number; count: number }) {
  if (count === 0) {
    return (
      <div className="bg-paper border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-loam flex items-center justify-center">
            <PiggyBank className="w-[18px] h-[18px] text-white" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-[15px] text-ink">Savings</h3>
            <p className="text-[12px] text-ink-soft">Earn interest, build credit</p>
          </div>
        </div>
        <p className="text-[13px] text-ink-soft mb-3">
          No savings account yet. Opening one helps you earn interest and build eligibility for future loans.
        </p>
        <Link
          href="/savings"
          className="flex items-center justify-between w-full py-2.5 px-3.5 bg-loam-light rounded-xl hover:bg-loam/10 transition"
        >
          <span className="text-[13px] font-medium text-loam">Open a savings account</span>
          <ChevronRight className="w-4 h-4 text-loam" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-paper border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-loam flex items-center justify-center">
          <PiggyBank className="w-[18px] h-[18px] text-white" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-semibold text-[15px] text-ink">Savings</h3>
          <p className="text-[12px] text-ink-soft">{count} active {count === 1 ? "account" : "accounts"}</p>
        </div>
        <Link href="/savings" className="text-[12px] text-indigo font-medium hover:underline">
          View →
        </Link>
      </div>
      <p className="font-mono text-[22px] font-semibold text-ink">{fmtNGN(total)}</p>
      <p className="text-[12px] text-ink-soft mt-0.5">Total savings balance</p>
    </div>
  );
}

// ─── Loan Summary Card — with helpful empty state ─────────
function LoanSummaryCard({ total, count, hasKyc }: { total: number; count: number; hasKyc: boolean }) {
  if (count === 0) {
    return (
      <div className="bg-paper border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-deep flex items-center justify-center">
            <Landmark className="w-[18px] h-[18px] text-white" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-[15px] text-ink">Loans</h3>
            <p className="text-[12px] text-ink-soft">Borrow against your savings</p>
          </div>
        </div>
        <p className="text-[13px] text-ink-soft mb-3">
          {hasKyc
            ? "No active loans. Build your savings to unlock borrowing power — you can borrow up to 3× your savings."
            : "No active loans. Verify your identity first, then build savings to unlock borrowing."}
        </p>
        <Link
          href="/loans"
          className="flex items-center justify-between w-full py-2.5 px-3.5 bg-indigo-light rounded-xl hover:bg-indigo/10 transition"
        >
          <span className="text-[13px] font-medium text-indigo">Check loan eligibility</span>
          <ChevronRight className="w-4 h-4 text-indigo" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-paper border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-deep flex items-center justify-center">
          <Landmark className="w-[18px] h-[18px] text-white" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-semibold text-[15px] text-ink">Loans</h3>
          <p className="text-[12px] text-ink-soft">{count} active {count === 1 ? "loan" : "loans"}</p>
        </div>
        <Link href="/loans" className="text-[12px] text-indigo font-medium hover:underline">
          View →
        </Link>
      </div>
      <p className="font-mono text-[22px] font-semibold text-ink">{fmtNGN(total)}</p>
      <p className="text-[12px] text-ink-soft mt-0.5">Outstanding balance</p>
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
        <p className="text-[12px] text-ink-soft mt-1">
          Your transaction history will appear here once you start using Agriqcap.{" "}
          <Link href="/wallet/deposit" className="text-indigo font-medium underline">Fund your wallet</Link>{" "}
          to get started.
        </p>
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
