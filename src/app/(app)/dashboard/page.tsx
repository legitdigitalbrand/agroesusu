"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  PiggyBank,
  Landmark,
  Bell,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Eye,
  EyeOff,
  ChevronRight,
  Copy,
  TrendingUp,
  Send,
  ArrowLeftRight,
  Receipt,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";

import { useMe } from "@/hooks/use-me";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  Button,
  StatusBadge,
  MoneyText,
  EmptyState,
  Skeleton,
  CardSkeleton,
} from "@/components/yield";
import { OnboardingChecklist } from "@/components/app/onboarding-checklist";
import { WelcomeBanner } from "@/components/app/welcome-banner";
import { formatRelativeTime, initials, formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Types (unchanged — same data shapes as before)
// ─────────────────────────────────────────────────────────────
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

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type?: string;
  created_at: string;
}

interface LoanItem {
  id: string;
  status: string;
  outstanding_balance: number;
  next_due_date: string | null;
  product_name?: string;
}

interface SavingsAccount {
  id: string;
  account_type: string;
  balance: number;
  product_name?: string;
  interest_rate?: number;
}


// ═══════════════════════════════════════════════════════════════
// Skeleton loaders (no spinners — per design spec)
// ═══════════════════════════════════════════════════════════════
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={56} height={56} />
        <div className="space-y-2">
          <Skeleton variant="text" className="w-64 h-7" />
          <Skeleton variant="text" className="w-48 h-4" />
        </div>
      </div>
      {/* Metrics row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      {/* Wallet hero skeleton */}
      <Skeleton variant="rectangular" className="h-48 rounded-[20px]" />
      {/* Quick actions skeleton */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" className="h-24 rounded-[20px]" />
        ))}
      </div>
      {/* Transactions skeleton */}
      <Skeleton variant="rectangular" className="h-64 rounded-[20px]" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Dashboard Page
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copiedAcct, setCopiedAcct] = useState(false);

  const { data: me, isLoading: meLoading, error: meError, refetch: refetchMe } = useMe();

  const walletId = me?.wallet?.id;

  // ── Data queries (unchanged — same hooks as before) ──
  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions?limit=8`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  const { data: fundingDetails } = useQuery<{
    provisioned: boolean;
    account?: { account_number: string; account_name: string; bank_name: string };
    message?: string;
  }>({
    queryKey: ["wallet-funding-details"],
    queryFn: async () => {
      const res = await fetch("/api/wallets/funding-details");
      if (!res.ok) return { provisioned: false };
      return res.json();
    },
    enabled: !!me,
  });

  const { data: creditScoreData } = useQuery<{
    has_score?: boolean;
    credit_score?: number;
    score?: number;
    risk_band?: string;
  }>({
    queryKey: ["credit-score"],
    queryFn: async () => {
      const res = await fetch("/api/credit-score");
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!me,
  });

  const { data: notifData } = useQuery<{
    notifications: NotificationItem[];
  }>({
    queryKey: ["dashboard-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=4");
      if (!res.ok) return { notifications: [] };
      return res.json();
    },
    enabled: !!me,
  });

  // Loans list — for upcoming repayments in right column
  const { data: loansData } = useQuery<{ loans?: LoanItem[] }>({
    queryKey: ["dashboard-loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans");
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!me,
  });

  // Savings accounts — for active savings in right column
  const { data: savingsData } = useQuery<{ accounts?: SavingsAccount[] }>({
    queryKey: ["dashboard-savings"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!me,
  });

  // ── Loading state: skeletons, not spinners ──
  if (meLoading) return <DashboardSkeleton />;
  if (meError || !me)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <p className="text-sm text-ink-soft">Couldn't load your dashboard</p>
          <Button variant="primary" size="sm" onClick={() => refetchMe()}>
            Try again
          </Button>
        </div>
      </div>
    );

  // ── Derived values (same logic, no changes) ──
  const wallet = me.wallet;
  const transactions = txData?.transactions || [];
  const notifications = notifData?.notifications || [];
  const dva = fundingDetails?.provisioned ? fundingDetails.account : null;
  const activeLoans = (loansData?.loans || []).filter((l) =>
    ["active", "disbursed", "approved"].includes(l.status)
  );
  const activeSavings = (savingsData?.accounts || []).filter((a) => a.balance > 0);
  const pendingVerifications = !((me.profile?.kyc_level || 0) >= 1);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.profile.full_name?.split(" ")[0] || "there";

  const savingsTotal = me?.summaries?.savings?.total_balance || 0;
  const savingsCount = me?.summaries?.savings?.count || 0;
  const loanTotal = me?.summaries?.loans?.total_outstanding || 0;
  const loanCount = me?.summaries?.loans?.count || 0;

  const scoreVal = creditScoreData?.credit_score ?? creditScoreData?.score;
  const creditScoreDisplay =
    creditScoreData?.has_score && scoreVal ? `${scoreVal}` : scoreVal ? `${scoreVal}` : "Building";

  const copyAcctNum = () => {
    if (dva?.account_number) {
      navigator.clipboard.writeText(dva.account_number);
      setCopiedAcct(true);
      setTimeout(() => setCopiedAcct(false), 2000);
    }
  };

  // ── Quick actions config ──
  const quickActions = [
    { label: "Fund Wallet", href: "/wallet/deposit", icon: Plus, color: "loam" },
    { label: "Transfer", href: "/wallet/transfer", icon: Send, color: "indigo" },
    { label: "Withdraw", href: "/wallet/withdraw", icon: ArrowLeftRight, color: "indigo" },
    { label: "Open Savings", href: "/savings", icon: PiggyBank, color: "loam" },
    { label: "Apply Loan", href: "/loans", icon: Landmark, color: "indigo" },
    { label: "Statements", href: "/statements", icon: Receipt, color: "loam" },
  ] as const;

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════
          1. HERO GREETING — premium welcome, lots of breathing room
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-loam-light text-indigo flex items-center justify-center font-display font-bold text-lg border border-loam/20 shadow-xs shrink-0">
            {initials(me.profile.full_name)}
          </div>
          <div className="space-y-1">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink leading-tight tracking-tight">
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm text-ink-soft leading-relaxed">
              Here&apos;s your financial overview today.
            </p>
          </div>
        </div>
      </div>

      {/* Banners (unchanged — just spaced better) */}
      <div className="space-y-4">
        <WelcomeBanner />
        <OnboardingChecklist />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          2. TOP METRICS — one horizontal row, soft shadows, no heavy borders
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Wallet Balance"
          value={
            balanceVisible ? (
              <MoneyText amount={wallet?.available_balance || 0} size="2xl" className="font-bold" />
            ) : (
              "••••••••"
            )
          }
          subtitle="Spendable • doesn't earn interest"
          icon={<Wallet className="w-5 h-5 text-indigo" strokeWidth={1.8} />}
          action={
            <button
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-parchment transition"
              title={balanceVisible ? "Hide balance" : "Show balance"}
            >
              {balanceVisible ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
            </button>
          }
        />
        <StatCard
          title="Savings Balance"
          value={<MoneyText amount={savingsTotal} size="2xl" className="font-bold" />}
          subtitle={`${savingsCount} active ${savingsCount === 1 ? "account" : "accounts"}`}
          icon={<PiggyBank className="w-5 h-5 text-indigo" strokeWidth={1.8} />}
        />
        <StatCard
          title="Outstanding Loan"
          value={<MoneyText amount={loanTotal} size="2xl" className="font-bold" />}
          subtitle={`${loanCount} active ${loanCount === 1 ? "loan" : "loans"}`}
          icon={<Landmark className="w-5 h-5 text-indigo" strokeWidth={1.8} />}
        />
        <StatCard
          title="Credit Score"
          value={<span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">{creditScoreDisplay}</span>}
          subtitle={
            creditScoreData?.risk_band
              ? `Band: ${creditScoreData.risk_band}`
              : "Save to build credit score"
          }
          icon={<TrendingUp className="w-5 h-5 text-indigo" strokeWidth={1.8} />}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3. WALLET HERO CARD — largest card, gradient, action buttons
          ═══════════════════════════════════════════════════════════ */}
      <Card variant="dark" padding="lg" className="relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-ochre/5 pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 rounded-full bg-indigo-light/5 pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Top: Label + balance toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
              Available Wallet Balance
            </span>
            <button
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
              title={balanceVisible ? "Hide balance" : "Show balance"}
            >
              {balanceVisible ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
            </button>
          </div>

          {/* Large balance number */}
          <div>
            {balanceVisible ? (
              <MoneyText
                amount={wallet?.available_balance || 0}
                size="3xl"
                className="text-white font-bold"
              />
            ) : (
              <span className="text-4xl sm:text-5xl font-bold font-mono text-white/40">••••••••</span>
            )}
          </div>

          {/* DVA account number + copy */}
          {dva && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/15">
                <span className="text-xs text-white/60 font-medium">Safe Haven MFB</span>
                <span className="text-xs text-white/40">•</span>
                <span className="text-sm font-mono text-white font-semibold tracking-wide">{dva.account_number}</span>
              </div>
              <button
                onClick={copyAcctNum}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
                title="Copy account number"
              >
                {copiedAcct ? (
                  <span className="text-xs font-semibold text-ochre">Copied!</span>
                ) : (
                  <Copy className="w-4 h-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
          )}

          {/* Action buttons — horizontal row */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/wallet/deposit">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ochre text-indigo-deep font-semibold text-sm hover:opacity-90 transition shadow-sm">
                <Plus className="w-4 h-4" strokeWidth={2} /> Fund
              </span>
            </Link>
            <Link href="/wallet/withdraw">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition border border-white/15">
                <ArrowUpRight className="w-4 h-4" strokeWidth={2} /> Withdraw
              </span>
            </Link>
            <Link href="/wallet/transfer">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition border border-white/15">
                <Send className="w-4 h-4" strokeWidth={2} /> Transfer
              </span>
            </Link>
            <Link href="/statements">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition border border-white/15">
                <Receipt className="w-4 h-4" strokeWidth={2} /> History
              </span>
            </Link>
          </div>
        </div>
      </Card>

      {/* ═══════════════════════════════════════════════════════════
          4. QUICK ACTIONS — 6 equal buttons, minimal, rounded
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href}>
              <Card
                variant="interactive"
                padding="none"
                className="flex flex-col items-center justify-center gap-3 p-5 h-full group hover:scale-[1.01] transition-transform duration-200"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                    action.color === "loam"
                      ? "bg-loam-light text-loam border border-loam/20"
                      : "bg-indigo/10 text-indigo border border-indigo/15"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <span className="text-xs font-semibold text-ink text-center leading-tight">{action.label}</span>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          5. MAIN + RIGHT COLUMN LAYOUT
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left/Main: Recent Transactions Table ── */}
        <div className="lg:col-span-8">
          <Card variant="elevated" padding="lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl">Recent Transactions</CardTitle>
                <CardDescription>Latest wallet activity</CardDescription>
              </div>
              <Link
                href="/statements"
                className="text-xs font-semibold text-indigo hover:text-indigo-deep flex items-center gap-1 transition"
              >
                See all <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </Link>
            </CardHeader>

            <CardContent>
              {txLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <Skeleton variant="circular" width={36} height={36} />
                      <div className="flex-1 space-y-2">
                        <Skeleton variant="text" className="w-1/3 h-4" />
                        <Skeleton variant="text" className="w-1/5 h-3" />
                      </div>
                      <Skeleton variant="text" className="w-20 h-4" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <EmptyState
                  title="No transactions yet"
                  message="Your transaction history will appear here once you start using Agriqcap."
                  icon={<Wallet className="w-6 h-6 text-ink-soft" strokeWidth={1.8} />}
                  action={
                    <Link href="/wallet/deposit">
                      <Button variant="primary" size="sm">
                        Fund Wallet
                      </Button>
                    </Link>
                  }
                />
              ) : (
                /* ── Transactions Table (real data, no fakes) ── */
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-line/60">
                        <th className="py-3 pr-4 text-xs font-semibold text-ink-soft uppercase tracking-wider">Date</th>
                        <th className="py-3 pr-4 text-xs font-semibold text-ink-soft uppercase tracking-wider">Description</th>
                        <th className="py-3 pr-4 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Type</th>
                        <th className="py-3 pr-4 text-xs font-semibold text-ink-soft uppercase tracking-wider text-right">Amount</th>
                        <th className="py-3 pl-4 text-xs font-semibold text-ink-soft uppercase tracking-wider text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {transactions.slice(0, 8).map((tx) => (
                        <tr key={tx.id} className="hover:bg-parchment/40 transition-colors">
                          {/* Date */}
                          <td className="py-3.5 pr-4 text-xs text-ink-soft whitespace-nowrap">
                            {formatDate(tx.created_at, { month: "short", day: "numeric" })}
                          </td>
                          {/* Description */}
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                  tx.direction === "credit"
                                    ? "bg-loam-light text-loam"
                                    : "bg-clay-light text-clay"
                                }`}
                              >
                                {tx.direction === "credit" ? (
                                  <ArrowDownLeft className="w-3.5 h-3.5" strokeWidth={2} />
                                ) : (
                                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                                )}
                              </div>
                              <span className="text-xs font-medium text-ink capitalize truncate max-w-[160px]">
                                {(tx.description || tx.transaction_type).replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>
                          {/* Type */}
                          <td className="py-3.5 pr-4 text-xs text-ink-soft capitalize hidden sm:table-cell">
                            {tx.transaction_type.replace(/_/g, " ")}
                          </td>
                          {/* Amount */}
                          <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                            <MoneyText
                              amount={tx.amount}
                              direction={tx.direction as "credit" | "debit"}
                              size="sm"
                              className="font-semibold"
                            />
                          </td>
                          {/* Status */}
                          <td className="py-3.5 pl-4 text-right">
                            <StatusBadge status={tx.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Contextual widgets (only shown if applicable) ── */}
        <div className="lg:col-span-4 space-y-5">
          {/* Upcoming Repayments — only if active loans */}
          {activeLoans.length > 0 && (
            <Card variant="elevated" padding="md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-indigo" strokeWidth={1.8} />
                  <CardTitle className="text-base">Upcoming Repayments</CardTitle>
                </div>
                <Link href="/loans" className="text-xs font-semibold text-indigo hover:text-indigo-deep transition">
                  View
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeLoans.slice(0, 3).map((loan) => (
                    <div key={loan.id} className="flex items-center justify-between py-2 border-b border-line/40 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-ink">
                          {loan.product_name || "Loan"}
                        </p>
                        <p className="text-[11px] text-ink-soft mt-0.5">
                          {loan.next_due_date
                            ? `Due ${formatDate(loan.next_due_date, { month: "short", day: "numeric" })}`
                            : "No due date"}
                        </p>
                      </div>
                      <MoneyText
                        amount={loan.outstanding_balance}
                        size="sm"
                        className="font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Savings — only if savings exist */}
          {activeSavings.length > 0 && (
            <Card variant="elevated" padding="md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-indigo" strokeWidth={1.8} />
                  <CardTitle className="text-base">Active Savings</CardTitle>
                </div>
                <Link href="/savings" className="text-xs font-semibold text-indigo hover:text-indigo-deep transition">
                  Manage
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeSavings.slice(0, 3).map((acct) => (
                    <div key={acct.id} className="flex items-center justify-between py-2 border-b border-line/40 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-ink capitalize">
                          {acct.product_name || acct.account_type.replace(/_/g, " ")}
                        </p>
                        {acct.interest_rate ? (
                          <p className="text-[11px] text-ink-soft mt-0.5">{acct.interest_rate}% p.a.</p>
                        ) : null}
                      </div>
                      <MoneyText
                        amount={acct.balance}
                        size="sm"
                        className="font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Notifications — only if notifications exist */}
          {notifications.length > 0 && (
            <Card variant="elevated" padding="md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo" strokeWidth={1.8} />
                  <CardTitle className="text-base">Notifications</CardTitle>
                </div>
                <Link href="/notifications" className="text-xs font-semibold text-indigo hover:text-indigo-deep transition">
                  All
                </Link>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-line/40">
                  {notifications.slice(0, 4).map((notif) => (
                    <Link
                      key={notif.id}
                      href="/notifications"
                      className="flex items-start gap-3 py-2.5 group hover:bg-parchment/30 -mx-2 px-2 rounded-lg transition"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${notif.read ? "bg-line" : "bg-clay"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink truncate">{notif.title}</p>
                        <p className="text-[11px] text-ink-soft truncate mt-0.5">{notif.message}</p>
                        <p className="text-[10px] text-ink-soft/70 mt-0.5">{formatRelativeTime(notif.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Verification — only if KYC not complete */}
          {pendingVerifications && (
            <Card variant="elevated" padding="md" className="border-ochre/30 bg-ochre-light/30">
              <CardContent className="pt-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-ochre/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-indigo-deep" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">Verify your identity</p>
                    <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                      Complete KYC verification to unlock all features including loans and higher limits.
                    </p>
                    <Link href="/settings" className="mt-2 inline-block">
                      <span className="text-xs font-semibold text-indigo hover:text-indigo-deep transition">
                        Verify now →
                      </span>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
