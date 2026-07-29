"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/yield";
import { TrendingUp, Users, Landmark, PiggyBank, Wallet } from "lucide-react";
import Link from "next/link";

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
  };
}

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

  if (isLoading) return <LoadingState message="Loading dashboard…" />;
  if (error || !data) return <ErrorState message="Couldn't load dashboard" onRetry={() => refetch()} />;

  const op = data.operational;
  const overview = data.overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl text-ink">Operational Dashboard</h1>
        <p className="text-sm text-ink-soft mt-0.5">Real-time platform metrics</p>
      </div>

      {/* Top-level metrics — 4 stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Wallet Balance"
          value={formatMoney(op.total_wallet_balance)}
          icon={Wallet}
          sublabel={`${op.total_wallets} wallets`}
        />
        <StatCard
          label="Total Savings"
          value={formatMoney(op.total_savings_balance)}
          icon={PiggyBank}
          sublabel="All active accounts"
        />
        <StatCard
          label="Loans Outstanding"
          value={formatMoney(op.total_loans_outstanding)}
          icon={Landmark}
          sublabel={`${op.active_loans} active · ${op.pending_loans} pending`}
          alert={op.pending_loans > 0}
        />
        <StatCard
          label="Investment Value"
          value={formatMoney(op.total_investments_value)}
          icon={TrendingUp}
          sublabel={`${op.active_investment_accounts} accounts`}
        />
      </div>

      {/* Two-column: portfolio + admin overview */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left — portfolio summary (2 cols) */}
        <div className="col-span-2 space-y-6">
          {/* Loan portfolio */}
          <div className="ys-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-ink">Loan Portfolio</h2>
              <Link href="/admin/loans" className="text-sm text-indigo hover:underline">Review queue →</Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MiniStat label="Active" value={op.active_loans} />
              <MiniStat label="Pending" value={op.pending_loans} highlight />
              <MiniStat label="Total Outstanding" value={formatMoney(op.total_loans_outstanding)} />
            </div>
          </div>

          {/* Savings & investments */}
          <div className="grid grid-cols-2 gap-4">
            <div className="ys-card">
              <div className="flex items-center gap-2 mb-3">
                <PiggyBank className="h-4 w-4 text-loam" />
                <h3 className="font-serif text-base text-ink">Savings Portfolio</h3>
              </div>
              <p className="font-mono text-2xl text-ink">{formatMoney(op.total_savings_balance)}</p>
            </div>
            <div className="ys-card">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-indigo" />
                <h3 className="font-serif text-base text-ink">Investments</h3>
              </div>
              <p className="font-mono text-2xl text-ink">{formatMoney(op.total_investments_value)}</p>
              <p className="text-xs text-ink-soft mt-1">{op.active_investment_accounts} active accounts</p>
            </div>
          </div>

          {/* Group savings */}
          <div className="ys-card">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-indigo" />
              <h3 className="font-serif text-base text-ink">Group Savings Pools</h3>
            </div>
            <p className="font-mono text-2xl text-ink">{formatMoney(op.total_group_savings || 0)}</p>
          </div>
        </div>

        {/* Right — admin overview */}
        <div className="space-y-4">
          {/* Staff & roles */}
          <div className="ys-card">
            <h3 className="font-serif text-base text-ink mb-3">Staff & Roles</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Total staff</span>
                <span className="font-mono text-ink">{overview.staff_count}</span>
              </div>
              {overview.role_distribution?.map((r) => (
                <div key={r.role} className="flex justify-between text-sm">
                  <span className="text-ink-soft capitalize">{r.role.replace(/_/g, " ")}</span>
                  <span className="font-mono text-ink">{r.count}</span>
                </div>
              ))}
            </div>
            <Link href="/admin/staff" className="block mt-4">
              <button className="ys-btn-ghost w-full text-sm">Manage staff →</button>
            </Link>
          </div>

          {/* Product counts */}
          <div className="ys-card">
            <h3 className="font-serif text-base text-ink mb-3">Products Configured</h3>
            <div className="space-y-2">
              {overview.product_counts &&
                Object.entries(overview.product_counts).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-ink-soft capitalize">{type.replace(/_/g, " ")}</span>
                    <span className="font-mono text-ink">{count}</span>
                  </div>
                ))}
            </div>
            <Link href="/admin/products" className="block mt-4">
              <button className="ys-btn-ghost w-full text-sm">Configure products →</button>
            </Link>
          </div>

          {/* Quick links */}
          <div className="ys-card">
            <h3 className="font-serif text-base text-ink mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/admin/loans" className="block text-sm text-indigo hover:underline">
                → Review pending loans ({op.pending_loans})
              </Link>
              <Link href="/admin/audit" className="block text-sm text-indigo hover:underline">
                → View audit log
              </Link>
              <Link href="/admin/reports" className="block text-sm text-indigo hover:underline">
                → Generate compliance report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function StatCard({
  label, value, icon: Icon, sublabel, alert,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sublabel?: string;
  alert?: boolean;
}) {
  return (
    <div className="ys-card relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-ink-soft uppercase tracking-wide">{label}</p>
          <p className="mt-1 font-mono text-xl text-ink">{value}</p>
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${alert ? "bg-ochre/15" : "bg-indigo/5"}`}>
          <Icon className={`h-4 w-4 ${alert ? "text-indigo" : "text-indigo"}`} />
        </div>
      </div>
      {sublabel && (
        <p className={`mt-2 text-xs ${alert ? "text-clay" : "text-ink-soft"}`}>{sublabel}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`font-mono text-lg ${highlight ? "text-indigo" : "text-ink"}`}>{value}</p>
    </div>
  );
}
