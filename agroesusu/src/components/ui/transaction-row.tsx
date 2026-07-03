import { formatNaira, timeAgo } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Gift } from "lucide-react";

interface TransactionRowProps {
  type: "deposit" | "withdrawal" | "interest" | "fee" | "bonus";
  amount: number;
  description: string;
  status: "pending" | "completed" | "failed";
  date: string;
}

const iconMap = {
  deposit: { icon: ArrowDownLeft, bg: "bg-brand-500/10", color: "text-brand-400" },
  withdrawal: { icon: ArrowUpRight, bg: "bg-red-500/10", color: "text-red-400" },
  interest: { icon: Gift, bg: "bg-brand-gold/10", color: "text-brand-gold" },
  fee: { icon: ArrowUpRight, bg: "bg-brand-500/5", color: "text-brand-300/60" },
  bonus: { icon: Gift, bg: "bg-brand-gold/10", color: "text-brand-gold" },
};

const statusColor = {
  pending: "text-brand-300/50",
  completed: "text-brand-50",
  failed: "text-red-400",
};

export function TransactionRow({ type, amount, description, status, date }: TransactionRowProps) {
  const { icon: Icon, bg, color } = iconMap[type] || iconMap.deposit;
  const isCredit = type === "deposit" || type === "interest" || type === "bonus";

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-brand-500/8 last:border-0">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} strokeWidth={2.5} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brand-50 truncate">{description}</p>
        <p className="text-xs text-brand-300/40 mt-0.5">{timeAgo(date)}</p>
      </div>

      <div className="text-right">
        <p className={`text-sm font-semibold tabular-nums ${statusColor[status]}`}>
          {isCredit ? "+" : "−"}
          {formatNaira(amount)}
        </p>
        {status === "pending" && (
          <p className="text-[10px] text-brand-300/40 mt-0.5 uppercase tracking-wide">Pending</p>
        )}
        {status === "failed" && (
          <p className="text-[10px] text-red-400 mt-0.5 uppercase tracking-wide">Failed</p>
        )}
      </div>
    </div>
  );
}
