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
        <div className="bg-white border border-brand-border rounded-xl p-4 hover:border-brand-green/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-stone-900 truncate">{displayName}</p>
            <span className="text-xs font-semibold text-brand-green tabular-nums">{percent}%</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${isComplete ? "bg-brand-gold" : "bg-brand-lime"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-stone-500 tabular-nums">
              {formatNaira(currentAmount)} / {formatNaira(targetAmount)}
            </span>
            {daysLeft !== null && !isComplete && (
              <span className="text-xs text-stone-400">{daysLeft}d left</span>
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
      <div className="bg-white border border-brand-border rounded-2xl p-5 hover:border-brand-green/30 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-base font-semibold text-stone-900">{displayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {type && (
                <span className="text-xs text-stone-500 capitalize">{type}</span>
              )}
              {interestRate !== undefined && interestRate > 0 && (
                <span className="text-xs text-brand-green font-medium">{interestRate}% interest</span>
              )}
              {daysLeft !== null && !isComplete && (
                <span className="text-xs text-stone-500">{daysLeft} days left</span>
              )}
              {isComplete && (
                <span className="text-xs font-medium text-brand-gold">Goal reached</span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-300" />
        </div>

        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-xl font-semibold text-stone-900 tabular-nums">
            {formatNaira(currentAmount)}
          </span>
          {targetAmount > 0 && (
            <span className="text-sm text-stone-400 tabular-nums">
              / {formatNaira(targetAmount)}
            </span>
          )}
        </div>

        {targetAmount > 0 && (
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-brand-gold" : "bg-brand-lime"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          {targetAmount > 0 ? (
            <span className="text-xs font-medium text-stone-600 tabular-nums">{percent}% complete</span>
          ) : (
            <span className="text-xs font-medium text-stone-600">Flexible savings</span>
          )}
          {isComplete ? (
            <span className="text-xs font-medium text-brand-gold">Withdraw available</span>
          ) : (
            <span className="text-xs text-stone-400">Tap to add money</span>
          )}
        </div>
      </div>
    </Link>
  );
}
