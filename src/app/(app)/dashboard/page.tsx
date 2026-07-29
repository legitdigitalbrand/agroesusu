"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import {
  LoadingState, ErrorState, Button,
} from "@/components/yield";
import { formatRelativeTime, initials } from "@/lib/format";
import {
  PiggyBank, Landmark, Users, TrendingUp,
  ShieldCheck, ChevronRight, Bell,
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

  return (
    <div className="space-y-4">
      {/* ─── Top bar: avatar + name + bell ─── */}
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

      {/* ─── Balance card (indigo gradient) ─── */}
      <div className="bg-gradient-to-br from-indigo to-[#0F4A13] rounded-2xl p-[18px] text-white relative overflow-hidden">
        {/* Label with wallet icon */}
        <p className="text-xs text-white/60 flex items-center gap-1.5 mb-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" />
          </svg>
          Total balance
        </p>
        {/* Amount */}
        <p className="font-mono text-[27px] font-medium">
          {wallet ? fmtNGN(wallet.available_balance) : "—"}
        </p>
        {/* Account number + Add money */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="font-mono text-[11.5px] text-white/50">
            {wallet?.account_number ? `•••• ${wallet.account_number.slice(-4)}` : "No account"}
          </span>
          <Link
            href="/wallet"
            className="bg-ochre text-ink text-[11.5px] font-medium px-3.5 py-1.5 rounded-full"
          >
            + Add money
          </Link>
        </div>
      </div>

      {/* ─── Quick action grid ─── */}
      <div className="flex gap-2.5">
        <QuickAction icon={PiggyBank} label="Save" href="/savings" />
        <QuickAction icon={Landmark} label="Borrow" href="/loans" />
        <QuickAction icon={Users} label="Co-op" href="/cooperative" />
        <QuickAction icon={TrendingUp} label="Invest" href="/investments" />
      </div>

      {/* ─── Promo card (dark indigo) ─── */}
      <Link href="/savings" className="block">
        <div className="bg-indigo-deep text-white rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[13.5px] font-medium">Lock savings for 90 days</p>
            <p className="text-[11px] text-white/60">Earn up to 11.2% p.a. on Harvest Lock</p>
          </div>
          <ChevronRight className="h-4 w-4 text-ochre flex-shrink-0" />
        </div>
      </Link>

      {/* ─── Verification widget (only if unverified) ─── */}
      {me.profile && me.profile.kyc_level < 3 && (
        <Link href="/onboarding" className="block">
          <div className="bg-parchment border border-indigo/30 rounded-2xl p-3.5 flex items-center gap-3 hover:shadow-sm transition">
            <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-indigo" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">
                Verify your account — Tier {me.profile.kyc_level} of 3
              </p>
              <p className="text-xs text-ink-soft">
                {me.profile.kyc_level === 0 && "Add BVN and NIN to unlock deposits"}
                {me.profile.kyc_level === 1 && "Add address to unlock loans"}
                {me.profile.kyc_level === 2 && "Complete verification for full access"}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-ink-soft flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* ─── Recent activity ─── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs text-ink-soft">Recent activity</p>
          <Link href="/wallet" className="text-xs text-indigo font-medium">See all</Link>
        </div>

        {txLoading ? (
          <LoadingState message="Loading transactions…" />
        ) : !txData?.transactions || txData.transactions.length === 0 ? (
          <div className="border border-line rounded-2xl p-6 text-center">
            <p className="text-sm text-ink-soft">No transactions yet</p>
            <Link href="/savings" className="mt-3 inline-block">
              <Button size="sm">Start saving</Button>
            </Link>
          </div>
        ) : (
          <div>
            {txData.transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick action chip ───
function QuickAction({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
  return (
    <Link href={href} className="flex-1 flex flex-col items-center text-center">
      <div className="w-full aspect-square rounded-2xl bg-loam-light flex items-center justify-center mb-1.5 transition hover:bg-track">
        <Icon className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} />
      </div>
      <span className="text-[11px] text-ink-soft">{label}</span>
    </Link>
  );
}

// ─── Transaction row with passbook stamp icon ───
function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isCredit = tx.direction === "credit";
  const typeLabel = tx.transaction_type.replace(/_/g, " ");
  const amountPrefix = isCredit ? "+" : "−";

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
      <div className="flex items-center gap-2.5">
        {/* Passbook stamp icon */}
        <div className="h-7 w-7 rounded-full border-[1.4px] border-loam flex items-center justify-center flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-loam">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-[13px] text-ink capitalize">{tx.description || typeLabel}</p>
          <p className="text-[11px] text-ink-soft mt-0.5">
            {tx.status === "success" ? "Confirmed" : "Pending"} · {formatRelativeTime(tx.created_at)}
          </p>
        </div>
      </div>
      <span className={`font-mono text-[13px] ${isCredit ? "text-loam" : "text-clay"}`}>
        {amountPrefix}₦{tx.amount.toLocaleString("en-NG", { minimumFractionDigits: 0 })}
      </span>
    </div>
  );
}
