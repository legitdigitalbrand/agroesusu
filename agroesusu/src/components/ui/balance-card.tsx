import { formatNaira } from "@/lib/utils";
import { NairaIcon } from "@/components/icons";

interface BalanceCardProps {
  totalBalance: number;
  totalSaved: number;
  totalWithdrawn: number;
  activeGoals?: number;
}

export function BalanceCard({ totalBalance, totalSaved, totalWithdrawn, activeGoals = 0 }: BalanceCardProps) {
  return (
    <div
      className="rounded-2xl p-5 shadow-soft border"
      style={{
        background: "var(--surface-card)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Total Savings
          </p>
          <p className="text-3xl font-semibold mt-1.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatNaira(totalBalance)}
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent-subtle)" }}
        >
          <NairaIcon className="w-5 h-5" style={{ color: "var(--accent)" }} />
        </div>
      </div>

      <div
        className="flex items-center gap-4 mt-4 pt-4 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Saved</p>
          <p className="text-sm font-medium tabular-nums mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {formatNaira(totalSaved)}
          </p>
        </div>
        <div className="w-px h-8" style={{ background: "var(--border-subtle)" }} />
        <div>
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Withdrawn</p>
          <p className="text-sm font-medium tabular-nums mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {formatNaira(totalWithdrawn)}
          </p>
        </div>
        <div className="w-px h-8" style={{ background: "var(--border-subtle)" }} />
        <div>
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Active Pots</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>{activeGoals}</p>
        </div>
      </div>
    </div>
  );
}
