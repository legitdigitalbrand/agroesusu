import { formatNaira } from "@/lib/utils";

interface BalanceCardProps {
  totalBalance: number;
  totalSaved: number;
  totalWithdrawn: number;
}

export function BalanceCard({ totalBalance, totalSaved }: BalanceCardProps) {
  return (
    <div className="bg-brand-green rounded-2xl p-5 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/60 font-medium uppercase tracking-wide">
            Total Savings
          </p>
          <p className="text-3xl font-semibold mt-1.5 tabular-nums">
            {formatNaira(totalBalance)}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-brand-lime/20 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-lime">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-[11px] text-white/50 uppercase tracking-wide">Saved</p>
          <p className="text-sm font-medium tabular-nums mt-0.5">{formatNaira(totalSaved)}</p>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div>
          <p className="text-[11px] text-white/50 uppercase tracking-wide">Active Goals</p>
          <p className="text-sm font-medium mt-0.5">3</p>
        </div>
      </div>
    </div>
  );
}
