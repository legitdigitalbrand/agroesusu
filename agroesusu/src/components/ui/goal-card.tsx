import Link from "next/link";
import { formatNaira, progressPercent, daysUntil } from "@/lib/utils";
import { DropletIcon, TargetIcon, WheatIcon, LockIcon, SeedlingIcon, TractorIcon, BarnIcon } from "@/components/icons";

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

// Map pot type (or icon key) to a Kuda-standard SVG icon component.
const TYPE_ICON_MAP: Record<string, typeof TargetIcon> = {
  flex: DropletIcon,
  goal: TargetIcon,
  seasonal: WheatIcon,
  stash: LockIcon,
  seeds: SeedlingIcon,
  fertilizer: SeedlingIcon,
  tractor: TractorIcon,
  equipment: TractorIcon,
  farm: BarnIcon,
  expansion: BarnIcon,
  default: TargetIcon,
};

function getPotIcon(name: string, icon?: string, type?: string) {
  const key = (icon || type || "").toLowerCase();
  if (TYPE_ICON_MAP[key]) return TYPE_ICON_MAP[key];
  const lowerName = name.toLowerCase();
  for (const k of Object.keys(TYPE_ICON_MAP)) {
    if (k !== "default" && lowerName.includes(k)) return TYPE_ICON_MAP[k];
  }
  return TYPE_ICON_MAP.default;
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
  const PotIconComp = getPotIcon(name, icon, type);

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
        {/* Top row: icon + name | amount */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--pot-icon-bg)" }}
            >
              <PotIconComp style={{ width: 18, height: 18, color: "var(--qa-icon-color)" }} />
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
