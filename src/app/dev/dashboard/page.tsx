"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/yield";
import {
  UserPlus, Landmark, Wallet, FileText, Activity,
} from "lucide-react";
import Link from "next/link";
import { formatNaira, formatRelativeTime } from "@/lib/format";

interface AdminDashboard {
  overview: {
    staff_count: number;
    role_distribution: Array<{ role: string; count: number }>;
    product_counts: Record<string, number>;
  };
  operational: {
    total_wallets: number;
    total_wallet_balance: number;
    total_savings_balance: number;
    total_loans_outstanding: number;
    active_loans: number;
    pending_loans: number;
    total_investments_value: number;
    active_investment_accounts: number;
    total_group_savings: number;
    total_customers?: number;
    active_groups?: number;
  };
}

interface PendingLoan {
  id: string;
  principal_amount: number;
  product_name: string;
  applicant_name: string;
  savings_tenure_months: number;
  multiplier: number;
  flags: string[];
}

interface ActivityItem {
  type: string;
  description: string;
  amount: number | null;
  entity_id: string;
  timestamp: string;
}

const ACTIVITY_ICONS: Record<string, typeof UserPlus> = {
  signup: UserPlus,
  loan: Landmark,
  transaction: Activity,
  funding: Wallet,
  admin: FileText,
};

export default function AdminDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery<AdminDashboard>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const { data: pendingLoansData } = useQuery<{ loans: PendingLoan[] }>({
    queryKey: ["pending-loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans?status=pending&limit=5");
      if (!res.ok) return { loans: [] };
      return res.json();
    },
  });

  const { data: activityData } = useQuery<{ activity: ActivityItem[] }>({
    queryKey: ["admin-activity"],
    queryFn: async () => {
      const res = await fetch("/api/admin/activity");
      if (!res.ok) return { activity: [] };
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  if (isLoading) return <LoadingState message="Loading dashboard…" />;
  if (error || !data) return <ErrorState message="Couldn't load dashboard" onRetry={() => refetch()} />;

  const op = data.operational;
  const overview = data.overview;
  const pendingLoans = pendingLoansData?.loans || [];
  const activities = activityData?.activity || [];

  const totalDeposits = (op.total_wallet_balance || 0) + (op.total_savings_balance || 0) + (op.total_investments_value || 0) + (op.total_group_savings || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl text-ink">Platform Overview</h1>
        <p className="text-[14px] text-ink-soft mt-1">
          Agriqcap Operations · last updated {new Date().toLocaleTimeString("en-NG")}
        </p>
      </div>

      {/* Metric cards — 4-column grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Deposits" value={formatNaira(totalDeposits)} delta="+3.1% this week" />
        <StatCard label="Active Loans" value={String(op.active_loans)} delta={op.pending_loans > 0 ? `${op.pending_loans} pending` : "No pending"} />
        <StatCard label="Loans Outstanding" value={formatNaira(op.total_loans_outstanding)} delta={`${op.active_loans} active`} />
        <StatCard label="Investment AUM" value={formatNaira(op.total_investments_value)} delta={`${op.active_investment_accounts} accounts`} />
        <StatCard label="Wallet Balance" value={formatNaira(op.total_wallet_balance)} delta={`${op.total_wallets} wallets`} />
        <StatCard label="Savings" value={formatNaira(op.total_savings_balance)} delta="Under management" />
        <StatCard label="Customers" value={String(op.total_customers || "—")} delta={`${op.active_groups || 0} active groups`} />
        <StatCard label="System Health" value="Operational" delta="All systems green" statusGreen />
      </div>

      {/* Two-column layout: pending reviews + live activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending loan reviews */}
        <div className="border border-line rounded-[14px] bg-paper overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
            <h3 className="text-[15px] font-medium text-ink">Pending Loan Reviews</h3>
            <Link href="/dev/loans" className="text-[13px] text-indigo hover:underline">View all</Link>
          </div>
          {pendingLoans.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-ink-soft">No pending loans to review.</p>
            </div>
          ) : (
            <div className="divide-y divide-track/30">
              {pendingLoans.slice(0, 5).map(loan => (
                <div key={loan.id} className="px-4 py-3 flex items-center justify-between hover:bg-parchment/30 transition">
                  <div>
                    <p className="text-sm font-medium text-ink">{loan.applicant_name}</p>
                    <p className="text-xs text-ink-soft">{loan.product_name} · {formatNaira(loan.principal_amount)}</p>
                  </div>
                  <Link href="/dev/loans" className="text-xs px-3 py-1.5 rounded-lg bg-indigo/10 text-indigo font-medium hover:bg-indigo/20 transition">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live activity feed */}
        <div className="border border-line rounded-[14px] bg-paper overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
            <h3 className="text-[15px] font-medium text-ink flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-loam animate-pulse" />
              Live Activity
            </h3>
            <span className="text-xs text-ink-soft">Auto-refresh 30s</span>
          </div>
          {activities.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-ink-soft">No recent activity.</p>
            </div>
          ) : (
            <div className="divide-y divide-track/30 max-h-[400px] overflow-y-auto">
              {activities.map((item, i) => {
                const Icon = ACTIVITY_ICONS[item.type] || Activity;
                return (
                  <div key={`${item.entity_id}-${i}`} className="px-4 py-2.5 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-ink-soft" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{item.description}</p>
                      <p className="text-xs text-ink-soft">
                        {formatRelativeTime(item.timestamp)}
                        {item.amount !== null && ` · ${formatNaira(item.amount)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Staff overview */}
      {overview.staff_count > 0 && (
        <div className="border border-line rounded-[14px] bg-paper p-4">
          <h3 className="text-[15px] font-medium text-ink mb-3">Staff Overview</h3>
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-ink-soft uppercase">Total Staff</p>
              <p className="text-lg font-semibold text-ink">{overview.staff_count}</p>
            </div>
            {overview.role_distribution?.slice(0, 5).map((r, i) => (
              <div key={i}>
                <p className="text-xs text-ink-soft uppercase">{r.role}</p>
                <p className="text-lg font-semibold text-ink">{r.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, delta, statusGreen }: { label: string; value: string; delta: string; statusGreen?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${statusGreen ? "text-loam" : "text-ink"}`}>
        {statusGreen && <span className="inline-block w-2 h-2 rounded-full bg-loam mr-1.5 animate-pulse" />}
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">{delta}</p>
    </div>
  );
}
