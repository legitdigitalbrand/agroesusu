"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import {
  LoadingState, ErrorState,
} from "@/components/yield";
import { formatRelativeTime, initials } from "@/lib/format";
import {
  PiggyBank, Landmark, Users, TrendingUp,
  ChevronRight, Bell, Wallet,
} from "lucide-react";
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
  const fmtNGN = (v: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(v || 0);
  const transactions = txData?.transactions || [];

  return (
    <>
      {/* ════════════════════════════════════════════
          MOBILE LAYOUT (hidden on md+)
          Matches mockup "Home" screen
         ════════════════════════════════════════════ */}
      <div className="md:hidden space-y-4">
        {/* Top bar: avatar + name + bell */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-[34px] w-[34px] rounded-full bg-loam-light flex items-center justify-center font-display font-medium text-indigo text-[13px]">
              {initials(me.profile.full_name)}
            </div>
            <p className="font-display font-medium text-[15px] text-ink">{me.profile.full_name}</p>
          </div>
          <Link href="/notifications" className="h-8 w-8 rounded-full bg-ochre-light flex items-center justify-center">
            <Bell className="h-4 w-4 text-indigo" strokeWidth={1.8} />
          </Link>
        </div>

        {/* Balance card (indigo gradient) */}
        <div className="bg-gradient-to-br from-indigo to-[#0F4A13] rounded-2xl p-[18px] text-white relative overflow-hidden">
          <p className="text-xs text-white/60 flex items-center gap-1.5 mb-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" />
            </svg>
            Total balance
          </p>
          <p className="font-mono text-[27px] font-medium">
            {wallet ? fmtNGN(wallet.available_balance) : "—"}
          </p>
          <div className="flex items-center justify-between mt-2.5">
            <span className="font-mono text-[11.5px] text-white/50">
              {wallet?.account_number ? `•••• ${wallet.account_number.slice(-4)}` : "No account"}
            </span>
            <Link href="/wallet" className="bg-ochre text-ink text-[11.5px] font-medium px-3.5 py-1.5 rounded-full">
              + Add money
            </Link>
          </div>
        </div>

        {/* Quick action grid */}
        <div className="flex gap-2.5">
          <QuickAction icon={PiggyBank} label="Save" href="/savings" />
          <QuickAction icon={Landmark} label="Borrow" href="/loans" />
          <QuickAction icon={Users} label="Co-op" href="/cooperative" />
          <QuickAction icon={TrendingUp} label="Invest" href="/investments" />
        </div>

        {/* Promo card */}
        <div className="bg-indigo-deep text-white rounded-2xl p-3.5 flex justify-between items-center">
          <div>
            <p className="text-[13.5px] font-medium mb-0.5">Lock savings for 90 days</p>
            <p className="text-[11px] text-white/50">Earn 11.2% p.a. on Harvest Lock</p>
          </div>
          <ChevronRight className="w-4 h-4 text-ochre" />
        </div>

        {/* Recent activity */}
        <p className="text-xs text-ink-soft flex justify-between">
          <span>Recent activity</span>
          <Link href="/statements" className="text-indigo font-medium">See all</Link>
        </p>

        <div className="flex-1">
          {txLoading ? (
            <LoadingState message="Loading activity…" />
          ) : transactions.length === 0 ? (
            <div className="border border-line rounded-2xl p-6 text-center">
              <p className="text-sm text-ink-soft">No transactions yet</p>
            </div>
          ) : (
            transactions.slice(0, 3).map((tx) => (
              <div key={tx.id} className="flex justify-between items-center py-2.5 border-b border-line last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full border-[1.4px] border-loam flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-loam">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[13px] text-ink">{tx.description || tx.transaction_type}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      Confirmed · {formatRelativeTime(tx.created_at)}
                    </p>
                  </div>
                </div>
                <span className={`font-mono text-[13px] ${tx.direction === "credit" ? "text-loam" : "text-clay"}`}>
                  {tx.direction === "credit" ? "+" : "−"}{fmtNGN(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          DESKTOP LAYOUT (hidden on mobile)
          Matches mockup "Desktop · Home" screen
         ════════════════════════════════════════════ */}
      <div className="hidden md:block space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="font-display font-bold text-[22px] text-ink">
            Good {getGreeting()}, {me.profile.full_name.split(" ")[0]}
          </h1>
          <p className="text-[13px] text-ink-soft mt-1">
            Here&apos;s what&apos;s happening across your savings, loans and cooperative today.
          </p>
        </div>

        {/* 4 metric cards row */}
        <div className="grid grid-cols-4 gap-2.5">
          <DesktopMetric
            icon={Wallet}
            label="Total balance"
            value={wallet ? fmtNGN(wallet.available_balance) : "—"}
            delta="+3.4%"
            deltaType="up"
          />
          <DesktopMetric
            icon={PiggyBank}
            label="Locked savings"
            value="₦134,000"
            delta="+1.1%"
            deltaType="up"
          />
          <DesktopMetric
            icon={TrendingUp}
            label="Contributions this month"
            value="₦25,000"
            delta="+8.6%"
            deltaType="up"
          />
          <DesktopMetric
            icon={Landmark}
            label="Repayments this month"
            value="₦28,500"
            delta="Due in 4d"
            deltaType="warn"
          />
        </div>

        {/* Chart + activity grid */}
        <div className="grid grid-cols-[1.7fr_1fr] gap-5 items-start">
          {/* Left — chart + recent activity */}
          <div className="space-y-4">
            {/* Bar chart widget */}
            <div className="border border-line rounded-2xl bg-paper p-[18px]">
              <div className="flex justify-between items-start mb-3.5">
                <div>
                  <p className="text-[11.5px] text-ink-soft mb-1">Savings growth</p>
                  <p className="font-mono text-[22px] text-ink">{wallet ? fmtNGN(wallet.available_balance) : "₦0"}</p>
                </div>
                <div className="flex gap-1 bg-parchment rounded-[10px] p-[3px]">
                  <span className="text-[11px] px-2.5 py-1.5 rounded-md bg-paper text-indigo font-medium shadow-sm">1M</span>
                  <span className="text-[11px] px-2.5 py-1.5 rounded-md text-ink-soft">3M</span>
                  <span className="text-[11px] px-2.5 py-1.5 rounded-md text-ink-soft">6M</span>
                  <span className="text-[11px] px-2.5 py-1.5 rounded-md text-ink-soft">1Y</span>
                </div>
              </div>
              {/* Simple bar chart */}
              <div className="flex items-end gap-2 h-[130px] px-0.5">
                {chartBars.map((bar, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative">
                    {bar.highlight && (
                      <div className="absolute bottom-full mb-2 bg-indigo-deep text-white font-mono text-[10.5px] px-2 py-1 rounded-md whitespace-nowrap">
                        ₦{bar.value}k
                      </div>
                    )}
                    <div
                      className={`w-full max-w-[22px] rounded-t-md rounded-b-sm ${bar.highlight ? "bg-ochre" : "bg-track"}`}
                      style={{ height: `${bar.height}%` }}
                    />
                    <span className="text-[10px] text-ink-soft mt-2">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity (desktop) */}
            <div className="border border-line rounded-2xl bg-paper p-[18px]">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-display font-medium text-[15px] text-ink">Recent activity</h3>
                <Link href="/statements" className="text-[12px] text-indigo font-medium hover:underline">
                  See all →
                </Link>
              </div>
              {txLoading ? (
                <LoadingState message="Loading…" />
              ) : transactions.length === 0 ? (
                <p className="text-sm text-ink-soft py-4 text-center">No transactions yet</p>
              ) : (
                transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center py-2.5 border-b border-line last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full border-[1.4px] border-loam flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-loam">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[13px] text-ink">{tx.description || tx.transaction_type}</p>
                        <p className="text-[11px] text-ink-soft mt-0.5">Confirmed · {formatRelativeTime(tx.created_at)}</p>
                      </div>
                    </div>
                    <span className={`font-mono text-[13px] ${tx.direction === "credit" ? "text-loam" : "text-clay"}`}>
                      {tx.direction === "credit" ? "+" : "−"}{fmtNGN(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right rail — desktop (matches mockup) */}
          <div className="space-y-3.5">
            {/* Members avatars */}
            <div className="border border-line rounded-2xl bg-paper p-4">
              <h4 className="text-[12.5px] font-medium text-ink-soft mb-3">Your cooperative</h4>
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-loam-light border-2 border-paper -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-semibold text-indigo">A</div>
                <div className="w-8 h-8 rounded-full bg-loam-light border-2 border-paper -ml-2 flex items-center justify-center text-[11px] font-semibold text-indigo">C</div>
                <div className="w-8 h-8 rounded-full bg-loam-light border-2 border-paper -ml-2 flex items-center justify-center text-[11px] font-semibold text-indigo">T</div>
                <div className="w-8 h-8 rounded-full bg-loam-light border-2 border-paper -ml-2 flex items-center justify-center text-[11px] font-semibold text-indigo">N</div>
                <div className="w-8 h-8 rounded-full bg-indigo border-2 border-paper -ml-2 flex items-center justify-center text-[10px] text-white">+8</div>
              </div>
            </div>

            {/* Account card (dark) */}
            <div className="bg-gradient-to-br from-indigo-deep to-[#0A2E0D] text-white rounded-2xl p-[18px]">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <p className="text-[9.5px] uppercase tracking-wider text-[#8FB98C] mb-1">DVA Account</p>
                  <p className="text-[13px] font-semibold">Agriqcap Wallet</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-ochre" strokeWidth={1.6} />
                </div>
              </div>
              <p className="font-mono text-[15px] tracking-wider mb-3">
                {wallet?.account_number || "— — — —"}
              </p>
              <div className="flex justify-between text-[9.5px] text-[#9FC79B]">
                <div>
                  <span>Available</span>
                  <strong className="block text-white font-mono text-[11.5px] font-normal mt-0.5">
                    {wallet ? fmtNGN(wallet.available_balance) : "₦0"}
                  </strong>
                </div>
                <div>
                  <span>Ledger</span>
                  <strong className="block text-white font-mono text-[11.5px] font-normal mt-0.5">
                    {wallet ? fmtNGN(wallet.ledger_balance) : "₦0"}
                  </strong>
                </div>
              </div>
            </div>

            {/* CTA row */}
            <div className="flex gap-2.5">
              <Link href="/wallet" className="flex-1 text-center bg-ochre text-ink font-semibold text-[12.5px] py-2.5 rounded-[11px]">
                Add money
              </Link>
              <Link href="/statements" className="flex-1 text-center bg-paper border border-line text-ink font-medium text-[12.5px] py-2.5 rounded-[11px]">
                Statement
              </Link>
            </div>

            {/* Quick actions grid */}
            <div className="grid grid-cols-3 gap-2">
              <QuickTile icon={PiggyBank} label="Save" href="/savings" />
              <QuickTile icon={Landmark} label="Borrow" href="/loans" />
              <QuickTile icon={Users} label="Co-op" href="/cooperative" />
            </div>

            {/* Promo */}
            <div className="bg-indigo text-white rounded-2xl p-4">
              <p className="text-[13.5px] font-semibold mb-1">Lock savings for 90 days</p>
              <p className="text-[11px] text-[#BFE0BE] mb-3">Earn 11.2% p.a. on Harvest Lock</p>
              <Link href="/savings" className="inline-block bg-ochre text-ink text-[11.5px] font-semibold px-4 py-2 rounded-[9px]">
                Open account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───

function QuickAction({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
  return (
    <Link href={href} className="flex-1 text-center">
      <div className="w-full aspect-square rounded-2xl bg-loam-light flex items-center justify-center mb-1.5">
        <Icon className="w-[19px] h-[19px] text-indigo" strokeWidth={1.8} />
      </div>
      <span className="text-[11px] text-ink-soft">{label}</span>
    </Link>
  );
}

function DesktopMetric({
  icon: Icon, label, value, delta, deltaType,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delta: string;
  deltaType: "up" | "warn";
}) {
  return (
    <div className="border border-line rounded-[14px] bg-paper p-3.5">
      <div className="flex justify-between items-start mb-2.5">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-loam-light flex items-center justify-center">
          <Icon className="w-[15px] h-[15px] text-indigo" strokeWidth={1.8} />
        </div>
      </div>
      <p className="text-[11px] text-ink-soft mb-1">{label}</p>
      <p className="font-mono text-[16.5px] text-ink">
        {value} <span className={`text-[10px] font-sans ${deltaType === "up" ? "text-loam" : "text-clay"}`}>{delta}</span>
      </p>
    </div>
  );
}

function QuickTile({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
  return (
    <Link href={href} className="text-center bg-parchment rounded-xl p-2.5 hover:bg-loam-light/50 transition">
      <Icon className="w-[15px] h-[15px] text-indigo mx-auto mb-1.5" strokeWidth={1.8} />
      <span className="text-[10px] text-ink-soft">{label}</span>
    </Link>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// Demo chart data (matches mockup bar heights)
const chartBars = [
  { label: "Jan", height: 40, value: "18", highlight: false },
  { label: "Feb", height: 55, value: "24", highlight: false },
  { label: "Mar", height: 48, value: "21", highlight: false },
  { label: "Apr", height: 62, value: "28", highlight: false },
  { label: "May", height: 70, value: "32", highlight: false },
  { label: "Jun", height: 58, value: "26", highlight: false },
  { label: "Jul", height: 85, value: "38", highlight: true },
];
