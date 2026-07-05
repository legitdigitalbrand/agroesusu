import { formatNaira, formatDate } from "@/lib/utils";

interface TransactionRowProps {
  type: string;
  amount: number;
  description: string;
  date: string;
  status?: string;
}

export function TransactionRow({ type, amount, description, date, status }: TransactionRowProps) {
  const isDeposit = type === "deposit" || amount > 0;
  const isPending = status === "pending";

  return (
    <div
      className="flex items-center gap-3 py-3 border-b last:border-b-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: isDeposit ? "var(--tx-icon-deposit-bg)" : "var(--tx-icon-withdraw-bg)",
        }}
      >
        {isDeposit ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
          {description || (isDeposit ? "Deposit" : "Withdrawal")}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {formatDate(date)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p
          className="text-sm font-bold tabular-nums"
          style={{ color: isDeposit ? "var(--tx-positive)" : "var(--tx-negative)" }}
        >
          {isDeposit ? "+" : "−"}{formatNaira(Math.abs(amount))}
        </p>
        {isPending && (
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Pending</p>
        )}
      </div>
    </div>
  );
}
