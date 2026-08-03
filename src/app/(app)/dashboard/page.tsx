"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  PiggyBank,
  Landmark,
  Bell,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Send,
  Eye,
  EyeOff,
  FileText,
  ChevronRight,
  Building2,
  Copy,
  TrendingUp,
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
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/yield";
import { OnboardingChecklist } from "@/components/app/onboarding-checklist";
import { WelcomeBanner } from "@/components/app/welcome-banner";
import { formatRelativeTime, initials } from "@/lib/format";

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

const fmtNGN = (v: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(v || 0);

function buildChartData(transactions: WalletTransaction[], currentBalance: number) {
  if (!transactions || transactions.length === 0) {
    return [];
  }
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const netTotal = sorted.reduce((acc, tx) => {
    return acc + (tx.direction === "credit" ? Number(tx.amount) : -Number(tx.amount));
  }, 0);

  const startBalance = Math.max(0, currentBalance - netTotal);
  let runningBalance = startBalance;

  const points = sorted.map((tx) => {
    const delta = tx.direction === "credit" ? Number(tx.amount) : -Number(tx.amount);
    runningBalance += delta;
    const dateStr = new Date(tx.created_at).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
    });
    return {
      date: dateStr,
      amount: Math.max(0, runningBalance),
    };
  });

  if (points.length === 1) {
    const firstDate = new Date(sorted[0].created_at);
    firstDate.setDate(firstDate.getDate() - 1);
    const prevDateStr = firstDate.toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
    });
    return [{ date: prevDateStr, amount: startBalance }, points[0]];
  }

  return points;
}

export default function DashboardPage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copiedAcct, setCopiedAcct] = useState(false);

  const { data: me, isLoading: meLoading, error: meError, refetch: refetchMe } = useMe();

  const walletId = me?.wallet?.id;

  // Transactions query
  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions?limit=8`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  // Wallet DVA query
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
  });

  // Credit score query
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
  });

  // Notifications query
  const { data: notifData, isLoading: notifLoading } = useQuery<{
    notifications: NotificationItem[];
  }>({
    queryKey: ["dashboard-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=4");
      if (!res.ok) return { notifications: [] };
      return res.json();
    },
  });

  if (meLoading) return <LoadingState message="Loading your dashboard…" />;
  if (meError || !me)
    return <ErrorState message="Couldn't load your dashboard" onRetry={() => refetchMe()} />;

  const wallet = me.wallet;
  const transactions = txData?.transactions || [];
  const notifications = notifData?.notifications || [];
  const dva = fundingDetails?.provisioned ? fundingDetails.account : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.profile.full_name?.split(" ")[0] || "there";

  const savingsTotal = me?.summaries?.savings?.total_balance || 0;
  const savingsCount = me?.summaries?.savings?.count || 0;
  const savingsInterest = me?.summaries?.savings?.total_interest || 0;
  const loanTotal = me?.summaries?.loans?.total_outstanding || 0;
  const loanCount = me?.summaries?.loans?.count || 0;
  const hasKyc = (me.profile?.kyc_level || 0) >= 1;

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

  const chartData = buildChartData(transactions, wallet?.available_balance || 0);

  return (
    <div className="space-y-6">
      {/* ── Top Header / Greeting ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-indigo flex items-center justify-center text-white font-display font-semibold text-base shadow-xs shrink-0">
            {initials(me.profile.full_name)}
          </div>
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-ink leading-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft">
              Here&apos;s what&apos;s happening with your money today.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Link
            href="/notifications"
            className="relative p-2.5 rounded-xl bg-paper border border-line text-ink hover:bg-parchment transition shrink-0"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-indigo-deep" strokeWidth={1.8} />
            {notifications.some((n) => !n.read) && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-clay" />
            )}
          </Link>
        </div>
      </div>

      {/* ── Banners ── */}
      <WelcomeBanner />
      <OnboardingChecklist />

      {/* ── 1. Overview Row: 4 StatCards in responsive grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Wallet Balance"
          value={balanceVisible ? fmtNGN(wallet?.available_balance || 0) : "••••••••"}
          subtitle={wallet?.status ? `Wallet: ${wallet.status}` : "Available funds"}
          icon={<Wallet className="w-5 h-5 text-indigo" />}
          action={
            <button
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="p-1 text-ink-soft hover:text-ink transition"
              title={balanceVisible ? "Hide balance" : "Show balance"}
            >
              {balanceVisible ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
        />

        <StatCard
          title="Savings Balance"
          value={fmtNGN(savingsTotal)}
          subtitle={`${savingsCount} active ${savingsCount === 1 ? "account" : "accounts"}`}
          icon={<PiggyBank className="w-5 h-5 text-indigo" />}
        />

        <StatCard
          title="Outstanding Loan"
          value={fmtNGN(loanTotal)}
          subtitle={`${loanCount} active ${loanCount === 1 ? "loan" : "loans"}`}
          icon={<Landmark className="w-5 h-5 text-indigo" />}
        />

        <StatCard
          title="Credit Score"
          value={creditScoreDisplay}
          subtitle={
            creditScoreData?.risk_band
              ? `Band: ${creditScoreData.risk_band}`
              : "Save to build credit score"
          }
          icon={<TrendingUp className="w-5 h-5 text-indigo" />}
        />
      </div>

      {/* ── 2. Wallet Hero Card ── */}
      <Card variant="dark" padding="lg" className="relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/80 font-semibold">
                Available Wallet Balance
              </span>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="p-1 text-white/70 hover:text-white transition"
              >
                {balanceVisible ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums">
              {balanceVisible ? fmtNGN(wallet?.available_balance || 0) : "••••••••"}
            </div>

            {/* DVA Account strip */}
            {dva ? (
              <div className="pt-2 flex items-center gap-3 text-xs text-white/90 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-white/10 font-mono font-medium">
                  {dva.bank_name}: {dva.account_number}
                </span>
                <button
                  onClick={copyAcctNum}
                  className="inline-flex items-center gap-1 text-white/80 hover:text-white underline font-medium transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedAcct ? "Copied!" : "Copy account number"}
                </button>
              </div>
            ) : !fundingDetails?.provisioned && fundingDetails ? (
              <p className="text-xs text-white/70">
                {fundingDetails.message ||
                  "Complete identity verification to get your account number."}
              </p>
            ) : null}
          </div>

          {/* 3 Quick action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/wallet/deposit">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Plus className="w-4 h-4 text-indigo-deep" />}
              >
                Fund
              </Button>
            </Link>
            <Link href="/wallet/transfer">
              <Button
                variant="outline"
                size="md"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
                leftIcon={<Send className="w-4 h-4 text-white" />}
              >
                Transfer
              </Button>
            </Link>
            <Link href="/wallet/withdraw">
              <Button
                variant="outline"
                size="md"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
                leftIcon={<Building2 className="w-4 h-4 text-white" />}
              >
                Withdraw
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* ── 4. Quick Actions Tiles (4 tiles) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/wallet/deposit">
          <Card
            variant="interactive"
            padding="sm"
            className="flex flex-col items-center text-center gap-2 group p-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo text-white flex items-center justify-center transition-transform group-hover:scale-105">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-ink">Fund Wallet</span>
          </Card>
        </Link>

        <Link href="/savings">
          <Card
            variant="interactive"
            padding="sm"
            className="flex flex-col items-center text-center gap-2 group p-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-loam text-white flex items-center justify-center transition-transform group-hover:scale-105">
              <PiggyBank className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-ink">Open Savings</span>
          </Card>
        </Link>

        <Link href="/loans">
          <Card
            variant="interactive"
            padding="sm"
            className="flex flex-col items-center text-center gap-2 group p-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-deep text-white flex items-center justify-center transition-transform group-hover:scale-105">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-ink">Check Loans</span>
          </Card>
        </Link>

        <Link href="/statements">
          <Card
            variant="interactive"
            padding="sm"
            className="flex flex-col items-center text-center gap-2 group p-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-loam-dim text-white flex items-center justify-center transition-transform group-hover:scale-105">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-ink">Statements</span>
          </Card>
        </Link>
      </div>

      {/* ── 3. Two-Column Layout (desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Summaries + Chart */}
        <div className="lg:col-span-7 space-y-6">
          {/* Savings Summary */}
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Savings Summary</CardTitle>
                <CardDescription>Target &amp; flexible savings accounts</CardDescription>
              </div>
              <Link
                href="/savings"
                className="text-xs font-semibold text-indigo hover:text-indigo-deep flex items-center gap-1 transition"
              >
                Manage <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>

            <CardContent>
              {savingsCount > 0 ? (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-parchment border border-line">
                    <div>
                      <p className="text-xs text-ink-soft font-medium">Total Savings</p>
                      <p className="font-mono text-2xl font-semibold text-ink mt-0.5">
                        {fmtNGN(savingsTotal)}
                      </p>
                    </div>
                    {savingsInterest > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-ink-soft font-medium">Earned Interest</p>
                        <p className="font-mono text-sm font-semibold text-loam mt-0.5">
                          +{fmtNGN(savingsInterest)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-soft">
                    <span>{savingsCount} active plan{savingsCount === 1 ? "" : "s"}</span>
                    <Link href="/savings" className="text-indigo font-medium underline">
                      View details
                    </Link>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No active savings plans"
                  message="Start saving today with flexible or locked target plans earning up to 14% p.a. to grow your farming capital."
                  icon={<PiggyBank className="w-6 h-6 text-indigo" />}
                  action={
                    <Link href="/savings">
                      <Button variant="primary" size="sm">
                        Open Savings Plan
                      </Button>
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Loan Summary */}
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Loan Summary</CardTitle>
                <CardDescription>Borrow against your savings</CardDescription>
              </div>
              <Link
                href="/loans"
                className="text-xs font-semibold text-indigo hover:text-indigo-deep flex items-center gap-1 transition"
              >
                View Loans <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>

            <CardContent>
              {loanCount > 0 ? (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-parchment border border-line">
                    <div>
                      <p className="text-xs text-ink-soft font-medium">Outstanding Balance</p>
                      <p className="font-mono text-2xl font-semibold text-ink mt-0.5">
                        {fmtNGN(loanTotal)}
                      </p>
                    </div>
                    <StatusBadge status="active" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-soft">
                    <span>{loanCount} active loan{loanCount === 1 ? "" : "s"}</span>
                    <Link href="/loans" className="text-indigo font-medium underline">
                      Loan details
                    </Link>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No active loans"
                  message={
                    hasKyc
                      ? "Build your savings to unlock borrowing power — you can borrow up to 3× your active savings balance."
                      : "Verify your identity (KYC) and build savings to unlock loan eligibility up to 3× your balance."
                  }
                  icon={<Landmark className="w-6 h-6 text-indigo" />}
                  action={
                    <Link href="/loans">
                      <Button variant="outline" size="sm">
                        Check Loan Eligibility
                      </Button>
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Balance Trend Area Chart */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Balance Trend</CardTitle>
              <CardDescription>Historical wallet balance trajectory</CardDescription>
            </CardHeader>

            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[220px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#1B5E20" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D6E8D2" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#4A5A44" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#4A5A44" }}
                        tickFormatter={(val) =>
                          `₦${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                        }
                      />
                      <Tooltip
                        formatter={(val: number) => [fmtNGN(val), "Balance"]}
                        contentStyle={{
                          backgroundColor: "#FBFDF9",
                          borderRadius: "12px",
                          border: "1px solid #D6E8D2",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                          fontSize: "12px",
                        }}
                        labelStyle={{ fontWeight: "600", color: "#1A2417" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#1B5E20"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorBalance)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-ink-soft">
                  Fund your wallet or make transactions to view your balance trend over time.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Activity + Notifications */}
        <div className="lg:col-span-5 space-y-6">
          {/* Recent Activity */}
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest wallet transactions</CardDescription>
              </div>
              <Link
                href="/statements"
                className="text-xs font-semibold text-indigo hover:text-indigo-deep flex items-center gap-1 transition"
              >
                See all <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>

            <CardContent>
              {txLoading ? (
                <LoadingState message="Loading activity…" />
              ) : transactions.length === 0 ? (
                <EmptyState
                  title="No transactions yet"
                  message="Your transaction history will appear here once you start using Agriqcap."
                  icon={<Wallet className="w-6 h-6 text-ink-soft" />}
                  action={
                    <Link href="/wallet/deposit">
                      <Button variant="primary" size="sm">
                        Fund Wallet
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-line/60">
                  {transactions.slice(0, 8).map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 py-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          tx.direction === "credit" ? "bg-loam-light text-loam" : "bg-clay-light text-clay"
                        }`}
                      >
                        {tx.direction === "credit" ? (
                          <ArrowDownLeft className="w-4 h-4" strokeWidth={2} />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink capitalize truncate">
                          {(tx.description || tx.transaction_type).replace(/_/g, " ")}
                        </p>
                        <p className="text-[11px] text-ink-soft mt-0.5">
                          {formatRelativeTime(tx.created_at)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <MoneyText
                          amount={tx.amount}
                          direction={tx.direction}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Updates and account alerts</CardDescription>
              </div>
              <Link
                href="/notifications"
                className="text-xs font-semibold text-indigo hover:text-indigo-deep flex items-center gap-1 transition"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>

            <CardContent>
              {notifLoading ? (
                <LoadingState message="Loading notifications…" />
              ) : notifications.length === 0 ? (
                <EmptyState
                  title="No notifications"
                  message="You'll see activity alerts and updates here."
                  icon={<Bell className="w-6 h-6 text-ink-soft" />}
                />
              ) : (
                <div className="divide-y divide-line/60">
                  {notifications.slice(0, 4).map((notif) => (
                    <Link
                      key={notif.id}
                      href="/notifications"
                      className="flex items-start gap-3 py-3 group hover:bg-parchment/30 -mx-2 px-2 rounded-xl transition"
                    >
                      <div className="p-2 rounded-xl bg-parchment text-indigo shrink-0 mt-0.5">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-ink truncate">
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-clay shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-ink-soft truncate mt-0.5">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-ink-soft/80 mt-1">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
