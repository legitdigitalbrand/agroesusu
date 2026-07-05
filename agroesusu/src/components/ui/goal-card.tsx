import Link from "next/link";
import { formatNaira, progressPercent, daysUntil } from "@/lib/utils";
import { ChevronRightIcon } from "@/components/icons";

interface GoalCardProps {
  id: string;
  name: string;
  type?: string;
  targetAmount: number;
  currentAmount: number;
  unlockDate?: string;
  icon?: string;
  interestRate?: number;
  variant?: "default" | "compact";
}

export function GoalCard({
  id,
  name,
  type,
  targetAmount,
  currentAmount,
  unlockDate,
  icon,
  interestRate,
  variant = "default",
}: GoalCardProps) {
  const percent = progressPercent(currentAmount, targetAmount);
  const daysLeft = unlockDate ? daysUntil(unlockDate) : null;
  const isComplete = percent >= 100;

  if (variant === "compact") {
    return (
      <Link href={`/save`} className="block">
        <div
          className="rounded-xl p-4 border transition-colors"
          style={{
            background: "var(--surface-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{name}</p>
            <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--accent)" }}>{percent}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${percent}%`,
                background: isComplete ? "var(--color-brand-gold)" : "var(--accent)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              {formatNaira(currentAmount)} / {formatNaira(targetAmount)}
            </span>
            {daysLeft !== null && !isComplete && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{daysLeft}d left</span>
            )}
            {isComplete && (
              <span className="text-xs font-medium" style={{ color: "var(--color-brand-gold)" }}>Goal reached</span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/deposit?account=${id}`} className="block">
      <div
        className="rounded-2xl p-5 border transition-colors"
        style={{
          background: "var(--surface-card)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {type && (
                <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{type}</span>
              )}
              {interestRate !== undefined && interestRate > 0 && (
                <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>{interestRate}% interest</span>
              )}
              {daysLeft !== null && !isComplete && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{daysLeft} days left</span>
              )}
              {isComplete && (
                <span className="text-xs font-medium" style={{ color: "var(--color-brand-gold)" }}>Goal reached</span>
              )}
            </div>
          </div>
          <ChevronRightIcon className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
        </div>

        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatNaira(currentAmount)}
          </span>
          {targetAmount > 0 && (
            <span className="text-sm tabular-nums" style={{ color: "var(--text-faint)" }}>
              / {formatNaira(targetAmount)}
            </span>
          )}
        </div>

        {targetAmount > 0 && (
          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "var(--surface-elevated)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${percent}%`,
                background: isComplete ? "var(--color-brand-gold)" : "var(--accent)",
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          {targetAmount > 0 ? (
            <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>{percent}% complete</span>
          ) : (
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Flexible savings</span>
          )}
          {isComplete ? (
            <span className="text-xs font-medium" style={{ color: "var(--color-brand-gold)" }}>Withdraw available</span>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tap to add money</span>
          )}
        </div>
      </div>
    </Link>
  );
}
