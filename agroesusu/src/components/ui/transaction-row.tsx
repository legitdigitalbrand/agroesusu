import { formatNaira, timeAgo } from "@/lib/utils";
import { ArrowDownLeftIcon, ArrowUpRightIcon, GiftIcon } from "@/components/icons";

interface TransactionRowProps {
  type: "deposit" | "withdrawal" | "interest" | "fee" | "bonus";
  amount: number;
  description: string;
  status: "pending" | "completed" | "failed";
  date: string;
}

export function TransactionRow({ type, amount, description, status, date }: TransactionRowProps) {
  const isCredit = type === "deposit" || type === "interest" || type === "bonus";
  const Icon = type === "deposit" ? ArrowDownLeftIcon : type === "withdrawal" || type === "fee" ? ArrowUpRightIcon : GiftIcon;

  const iconBg = isCredit ? "var(--accent-subtle)" : type === "withdrawal" ? "rgba(255,77,109,0.1)" : "var(--accent-subtle)";
  const iconColor = isCredit ? "var(--accent)" : type === "withdrawal" ? "var(--danger)" : "var(--color-brand-gold)";

  const statusColor = status === "pending" ? "var(--text-muted)" : status === "failed" ? "var(--danger)" : "var(--text-primary)";

  return (
    <div
      className="flex items-center gap-3 py-3.5 border-b last:border-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: iconBg }}>
        <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={2.5} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{description}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{timeAgo(date)}</p>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums" style={{ color: statusColor }}>
          {isCredit ? "+" : "−"}
          {formatNaira(amount)}
        </p>
        {status === "pending" && (
          <p className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Pending</p>
        )}
        {status === "failed" && (
          <p className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--danger)" }}>Failed</p>
        )}
      </div>
    </div>
  );
}
