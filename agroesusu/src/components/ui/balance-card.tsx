import { formatNaira } from "@/lib/utils";

interface BalanceCardProps {
  totalBalance: number;
  totalSaved: number;
  totalWithdrawn: number;
  activeGoals?: number;
}

export function BalanceCard({ totalBalance, activeGoals = 0 }: BalanceCardProps) {
  return (
    <div
      className="mx-5 rounded-2xl p-6"
      style={{
        background: "var(--balance-card-bg)",
        border: "1px solid var(--balance-card-border)",
      }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--balance-card-label)" }}>
        Total Savings
      </p>
      <p className="text-3xl font-bold mt-1.5 tabular-nums tracking-tight" style={{ color: "var(--balance-card-text)" }}>
        {formatNaira(totalBalance)}
      </p>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        <p className="text-xs" style={{ color: "var(--balance-card-sub)" }}>
          {activeGoals > 0 ? `${activeGoals} active pot${activeGoals > 1 ? 's' : ''}` : 'Start saving today'}
        </p>
      </div>
    </div>
  );
}
