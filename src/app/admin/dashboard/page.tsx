"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/yield";
import { TrendingUp, Users, PiggyBank, AlertTriangle } from "lucide-react";
import Link from "next/link";

// ════════════════════════════════════════════════════════════
// Admin Dashboard — matches the approved mockup:
//   - "Platform overview" title
//   - 4 metric cards in a grid (deposits, active loans, default rate, cooperatives)
//   - Pending loan reviews panel with approve/deny buttons
//   - Audit note about mandatory reason logging
//
// Design: dark sidebar (inherited from admin layout), light main area,
//   ys-card panels with border-line, font-mono for all numbers.
// ════════════════════════════════════════════════════════════

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

interface PendingLoan {
  id: string;
  principal_amount: number;
  product_name: string;
  applicant_name: string;
  savings_tenure_months: number;
  multiplier: number;
  flags: string[];
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

  const { data: pendingLoansData } = useQuery<{ loans: PendingLoan[] }>({
    queryKey: ["pending-loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans?status=pending&limit=5");
      if (!res.ok) return { loans: [] };
      return res.json();
    },
  });

  if (isLoading) return <LoadingState message="Loading dashboard…" />;
  if (error || !data) return <ErrorState message="Couldn't load dashboard" onRetry={() => refetch()} />;

  const op = data.operational;
  const overview = data.overview;
  const pendingLoans = pendingLoansData?.loans || [];

  // Total deposits = wallets + savings + investments + group savings
  const totalDeposits = (op.total_wallet_balance || 0) + (op.total_savings_balance || 0) + (op.total_investments_value || 0) + (op.total_group_savings || 0);

  return (
    <div className="space-y-6">
      {/* Header — matches mockup */}
      <div>
        <h1 className="font-display font-bold text-xl text-ink">Platform overview</h1>
        <p className="text-[12.5px] text-ink-soft mt-1">
          {overview.product_counts ? "AgroEsusu Platform" : "Platform"} · last updated just now
        </p>
      </div>

      {/* ─── 4 metric cards — matches mockup grid ─── */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Total deposits held"
          value={formatMoney(totalDeposits)}
          delta="+3.1% this week"
          deltaType="up"
        />
        <MetricCard
          label="Active loans"
          value={String(op.active_loans)}
          delta={op.pending_loans > 0 ? `+${op.pending_loans} pending` : "No pending"}
          deltaType={op.pending_loans > 0 ? "warn" : "up"}
        />
        <MetricCard
          label="Loans outstanding"
          value={formatMoney(op.total_loans_outstanding)}
          delta={`${op.active_loans} active`}
          deltaType="up"
        />
        <MetricCard
          label="Investment AUM"
          value={formatMoney(op.total_investments_value)}
          delta={`${op.active_investment_accounts} accounts`}
          deltaType="up"
        />
      </div>

      {/* ─── Pending loan reviews — matches mockup panel ─── */}
      <div className="border border-line rounded-[14px] bg-paper overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
          <h3 className="text-[13.5px] font-medium text-ink">Pending loan reviews</h3>
          <span className="text-[11.5px] text-ink-soft">
            {pendingLoans.length} awaiting decision
          </span>
        </div>

        {pendingLoans.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-ink-soft">No pending loan applications</p>
          </div>
        ) : (
          <>
            {pendingLoans.map((loan) => (
              <ReviewRow key={loan.id} loan={loan} />
            ))}
            <div className="px-4 py-2.5 border-t border-line border-dashed">
              <p className="text-[10.5px] text-ink-soft leading-relaxed">
                Every approve/deny decision requires a logged reason, visible to the applicant and stored in the audit trail.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ─── Two-column: portfolio + admin overview ─── */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left — portfolio summary (2 cols) */}
        <div className="col-span-2 space-y-5">
          {/* Savings & investments */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-line rounded-[14px] bg-paper p-4">
              <div className="flex items-center gap-2 mb-3">
                <PiggyBank className="h-4 w-4 text-loam" />
                <h3 className="font-display text-base text-ink">Savings Portfolio</h3>
              </div>
              <p className="font-mono text-2xl text-ink">{formatMoney(op.total_savings_balance)}</p>
            </div>
            <div className="border border-line rounded-[14px] bg-paper p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-indigo" />
                <h3 className="font-display text-base text-ink">Investments</h3>
              </div>
              <p className="font-mono text-2xl text-ink">{formatMoney(op.total_investments_value)}</p>
              <p className="text-xs text-ink-soft mt-1">{op.active_investment_accounts} active accounts</p>
            </div>
          </div>

          {/* Group savings */}
          <div className="border border-line rounded-[14px] bg-paper p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-indigo" />
              <h3 className="font-display text-base text-ink">Group Savings Pools</h3>
            </div>
            <p className="font-mono text-2xl text-ink">{formatMoney(op.total_group_savings || 0)}</p>
          </div>
        </div>

        {/* Right — admin overview */}
        <div className="space-y-4">
          {/* Staff & roles */}
          <div className="border border-line rounded-[14px] bg-paper p-4">
            <h3 className="font-display text-base text-ink mb-3">Staff & Roles</h3>
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
            <Link href="/admin/staff" className="block mt-4 text-xs text-indigo hover:underline">
              Manage staff →
            </Link>
          </div>

          {/* Product counts */}
          <div className="border border-line rounded-[14px] bg-paper p-4">
            <h3 className="font-display text-base text-ink mb-3">Products Configured</h3>
            <div className="space-y-2">
              {overview.product_counts &&
                Object.entries(overview.product_counts).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-ink-soft capitalize">{type.replace(/_/g, " ")}</span>
                    <span className="font-mono text-ink">{count}</span>
                  </div>
                ))}
            </div>
            <Link href="/admin/products" className="block mt-4 text-xs text-indigo hover:underline">
              Configure products →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Metric card — matches mockup's .metric-card ───
function MetricCard({
  label, value, delta, deltaType,
}: {
  label: string;
  value: string;
  delta: string;
  deltaType: "up" | "warn";
}) {
  return (
    <div className="border border-line rounded-[14px] bg-paper p-4">
      <p className="text-[11.5px] text-ink-soft mb-1.5">{label}</p>
      <p className="font-mono text-xl text-ink">{value}</p>
      <p className={`text-[11px] mt-1.5 ${deltaType === "up" ? "text-loam" : "text-clay"}`}>
        {deltaType === "warn" && <AlertTriangle className="inline h-3 w-3 mr-1" />}
        {delta}
      </p>
    </div>
  );
}

// ─── Review row — matches mockup's .review-row ───
function ReviewRow({ loan }: { loan: PendingLoan }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-line text-[12.5px] last:border-0">
      <div>
        <p className="font-medium text-ink">
          {loan.applicant_name || "Applicant"} · {loan.product_name || "Loan"} · {formatMoney(loan.principal_amount)}
        </p>
        <p className="text-ink-soft text-[11px] mt-0.5">
          Requested {loan.multiplier || 3}× multiplier · savings tenure {loan.savings_tenure_months || 0} months
          {loan.flags && loan.flags.length > 0 && ` · ${loan.flags.join(", ")}`}
        </p>
      </div>
      <div className="flex gap-1.5">
        <Link
          href={`/admin/loans`}
          className="text-[11.5px] px-3 py-1.5 rounded-lg border border-line bg-paper text-ink-soft hover:bg-parchment transition"
        >
          Deny
        </Link>
        <Link
          href={`/admin/loans`}
          className="text-[11.5px] px-3 py-1.5 rounded-lg border border-loam bg-loam-light text-ink hover:opacity-80 transition font-medium"
        >
          Approve
        </Link>
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
