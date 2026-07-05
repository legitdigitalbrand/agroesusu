import Link from "next/link";
import { formatNaira, progressPercent, daysUntil } from "@/lib/utils";

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

// Emoji map for common savings goals
const POT_EMOJIS: Record<string, string> = {
  seeds: "🌱",
  fertilizer: "🌱",
  tractor: "🚜",
  equipment: "🚜",
  farm: "🏠",
  expansion: "🏠",
  animals: "🐄",
  feed: "🌾",
  harvest: "🌾",
  irrigation: "💧",
  default: "🎯",
};

function getPotEmoji(name: string, icon?: string): string {
  if (icon && POT_EMOJIS[icon.toLowerCase()]) return POT_EMOJIS[icon.toLowerCase()];
  const lowerName = name.toLowerCase();
  for (const key of Object.keys(POT_EMOJIS)) {
    if (key !== "default" && lowerName.includes(key)) return POT_EMOJIS[key];
  }
  return POT_EMOJIS.default;
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
  const emoji = getPotEmoji(name, icon);

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
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--progress-track)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${percent}%`,
                background: isComplete ? "var(--color-brand-gold)" : "var(--progress-fill)",
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
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/deposit?account=${id}`} className="block">
      <div
        className="rounded-2xl p-4 border transition-colors"
        style={{
          background: "var(--surface-card)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Top row: emoji + name | amount */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: "var(--pot-icon-bg)" }}
            >
              {emoji}
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{name}</span>
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatNaira(currentAmount)}
          </span>
        </div>

        {/* Progress bar */}
        {targetAmount > 0 && (
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--progress-track)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${percent}%`,
                background: isComplete ? "var(--color-brand-gold)" : "var(--progress-fill)",
              }}
            />
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between">
          {targetAmount > 0 ? (
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              {percent}% of {formatNaira(targetAmount)}
            </span>
          ) : (
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Flexible savings</span>
          )}
          {isComplete ? (
            <span className="text-xs font-medium" style={{ color: "var(--color-brand-gold)" }}>Goal reached</span>
          ) : daysLeft !== null ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {daysLeft} {daysLeft === 1 ? "month" : "months"} left
            </span>
          ) : interestRate && interestRate > 0 ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{interestRate}% interest</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
