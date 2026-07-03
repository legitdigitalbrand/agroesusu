import Link from "next/link";
import { formatNaira, progressPercent, daysUntil } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

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
  const displayName = icon ? `${icon} ${name}` : name;

  if (variant === "compact") {
    return (
      <Link href={`/save`} className="block">
        <div className="bg-brand-900 border border-brand-500/10 rounded-xl p-4 hover:border-brand-500/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-brand-50 truncate">{displayName}</p>
            <span className="text-xs font-semibold text-brand-400 tabular-nums">{percent}%</span>
          </div>
          <div className="h-1.5 bg-brand-950 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${isComplete ? "bg-brand-gold" : "bg-brand-500"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-brand-300/60 tabular-nums">
              {formatNaira(currentAmount)} / {formatNaira(targetAmount)}
            </span>
            {daysLeft !== null && !isComplete && (
              <span className="text-xs text-brand-300/50">{daysLeft}d left</span>
            )}
            {isComplete && (
              <span className="text-xs font-medium text-brand-gold">Goal reached</span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/deposit?account=${id}`} className="block">
      <div className="bg-brand-900 border border-brand-500/10 rounded-2xl p-5 hover:border-brand-500/30 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-base font-semibold text-brand-50">{displayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {type && (
                <span className="text-xs text-brand-300/60 capitalize">{type}</span>
              )}
              {interestRate !== undefined && interestRate > 0 && (
                <span className="text-xs text-brand-400 font-medium">{interestRate}% interest</span>
              )}
              {daysLeft !== null && !isComplete && (
                <span className="text-xs text-brand-300/60">{daysLeft} days left</span>
              )}
              {isComplete && (
                <span className="text-xs font-medium text-brand-gold">Goal reached</span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-brand-500/40" />
        </div>

        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-xl font-semibold text-brand-50 tabular-nums">
            {formatNaira(currentAmount)}
          </span>
          {targetAmount > 0 && (
            <span className="text-sm text-brand-300/40 tabular-nums">
              / {formatNaira(targetAmount)}
            </span>
          )}
        </div>

        {targetAmount > 0 && (
          <div className="h-2 bg-brand-950 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-brand-gold" : "bg-brand-500"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          {targetAmount > 0 ? (
            <span className="text-xs font-medium text-brand-200 tabular-nums">{percent}% complete</span>
          ) : (
            <span className="text-xs font-medium text-brand-200">Flexible savings</span>
          )}
          {isComplete ? (
            <span className="text-xs font-medium text-brand-gold">Withdraw available</span>
          ) : (
            <span className="text-xs text-brand-300/50">Tap to add money</span>
          )}
        </div>
      </div>
    </Link>
  );
}
