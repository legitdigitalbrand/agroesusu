"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import {
  Card, MoneyText, StampIcon, ProgressRing,
  LoadingState, ErrorState, EmptyState, Button,
} from "@/components/yield";
import { formatRelativeTime } from "@/lib/format";
import { ArrowUpRight, ArrowDownLeft, PiggyBank, Landmark, TrendingUp, ShieldCheck, ChevronRight } from "lucide-react";
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

export default function DashboardPage() {
  const { data: me, isLoading: meLoading, error: meError, refetch: refetchMe } = useMe();

  const walletId = me?.wallet?.id;
  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions?limit=5`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  if (meLoading) return <LoadingState message="Loading your dashboard…" />;
  if (meError || !me) return <ErrorState message="Couldn't load your dashboard" onRetry={() => refetchMe()} />;

  const wallet = me.wallet;
  const summaries = me.summaries;
  const firstName = me.profile.full_name.split(" ")[0];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-sm text-ink-soft">Welcome back,</p>
        <h1 className="font-serif text-2xl text-ink">{firstName}</h1>
      </div>

      {/* Wallet balance — indigo hero card */}
      <Card variant="dark" className="relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-12 h-24 w-24 rounded-full bg-ochre/10" />
        <div className="relative">
          <p className="text-xs text-white/60 uppercase tracking-wide">Available Balance</p>
          <p className="mt-1 font-mono text-3xl text-white">
            {wallet ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(wallet.available_balance) : "—"}
          </p>
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <p className="text-white/50 text-xs">Pending</p>
              <p className="font-mono text-white/80">
                {wallet ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(wallet.pending_balance) : "—"}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-xs">Reserved</p>
              <p className="font-mono text-white/80">
                {wallet ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(wallet.reserved_balance) : "—"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        <QuickAction icon={PiggyBank} label="Save" href="/savings" />
        <QuickAction icon={Landmark} label="Borrow" href="/loans" />
        <QuickAction icon={TrendingUp} label="Invest" href="/investments" />
        <QuickAction icon={ArrowUpRight} label="Co-op" href="/cooperative" />
      </div>

      {/* Account summaries */}
      <div className="grid grid-cols-2 gap-3">
        {/* Savings summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <PiggyBank className="h-4 w-4 text-loam" />
            {summaries?.savings && summaries.savings.count > 0 && (
              <ProgressRing progress={65} size={32} strokeWidth={4} />
            )}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Savings</p>
          <p className="font-mono text-lg text-ink">
            {summaries ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(summaries.savings.total_balance) : "₦0"}
          </p>
          {summaries?.savings && summaries.savings.count > 0 ? (
            <p className="text-xs text-loam mt-0.5">{summaries.savings.count} active {summaries.savings.count === 1 ? "account" : "accounts"}</p>
          ) : (
            <Link href="/savings" className="text-xs text-indigo hover:underline mt-0.5 block">Start saving →</Link>
          )}
        </Card>

        {/* Loans summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Landmark className="h-4 w-4 text-indigo" />
            {summaries?.loans?.has_pending && <span className="text-xs text-ochre font-medium">Pending</span>}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Loans</p>
          <p className="font-mono text-lg text-ink">
            {summaries ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(summaries?.loans?.total_outstanding || 0) : "₦0"}
          </p>
          <p className="text-xs text-ink-soft mt-0.5">
            {summaries?.loans?.count ? `${summaries.loans.count} active` : "No active loans"}
          </p>
        </Card>
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg text-ink">Recent Activity</h2>
          <Link href="/wallet" className="text-sm text-indigo hover:underline">View all</Link>
        </div>

        {txLoading ? (
          <LoadingState message="Loading transactions…" />
        ) : !txData?.transactions || txData.transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            message="Your recent transactions will appear here."
            action={<Link href="/savings"><Button size="sm">Start saving</Button></Link>}
          />
        ) : (
          <div className="space-y-2">
            {txData.transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>


      {/* Verification widget */}
      {me.profile && me.profile.kyc_level < 3 && (
        <Link href="/onboarding">
          <Card className="bg-parchment border-indigo/30 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-indigo" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">
                  Verify your account — Tier {me.profile.kyc_level} of 3
                </p>
                <p className="text-xs text-ink-soft">
                  {me.profile.kyc_level === 0 && "Add BVN and NIN to unlock deposits"}
                  {me.profile.kyc_level === 1 && "Add address and occupation to unlock loans"}
                  {me.profile.kyc_level === 2 && "Complete verification to unlock all features"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-ink-soft" />
            </div>
          </Card>
        </Link>
      )}

      {/* Investment teaser */}
      {summaries?.investments && summaries.investments.count === 0 && (
        <Card className="bg-parchment border-track/60">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-loam flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">Grow your money</p>
              <p className="text-xs text-ink-soft">Invest in agricultural pools from ₦10,000</p>
            </div>
            <Link href="/investments">
              <Button size="sm">Explore</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5">
      <div className="h-12 w-12 rounded-xl bg-parchment flex items-center justify-center transition hover:bg-track/40">
        <Icon className="h-5 w-5 text-indigo" />
      </div>
      <span className="text-xs text-ink-soft">{label}</span>
    </Link>
  );
}

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isCredit = tx.direction === "credit";
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
  const typeLabel = tx.transaction_type.replace(/_/g, " ");

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-track/30 last:border-0">
      {/* Direction icon */}
      <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isCredit ? "bg-loam/10" : "bg-clay/10"}`}>
        <Icon className={`h-4 w-4 ${isCredit ? "text-loam" : "text-clay"}`} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink capitalize">{typeLabel}</p>
        <p className="text-xs text-ink-soft">{formatRelativeTime(tx.created_at)}</p>
      </div>

      {/* Amount + stamp */}
      <div className="text-right">
        <MoneyText
          amount={tx.amount}
          direction={tx.direction}
          size="sm"
        />
        {tx.status === "success" && (
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <StampIcon size={12} className="text-loam" />
            <span className="text-[10px] text-ink-soft">confirmed</span>
          </div>
        )}
      </div>
    </div>
  );
}
