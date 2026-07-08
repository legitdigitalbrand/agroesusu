import { formatNaira, formatDate } from "@/lib/utils";

interface TransactionRowProps {
  type: string;
  amount: number;
  description: string;
  date: string;
  status?: string;
}

const MONEY_IN_TYPES = new Set(["deposit", "group_payout"]);
const MONEY_OUT_TYPES = new Set(["withdrawal", "group_contribution"]);

export function TransactionRow({ type, amount, description, date, status }: TransactionRowProps) {
  // All amounts are stored positive in this schema, so direction must come
  // from the transaction TYPE, never from the sign of the amount — a naive
  // `amount > 0` check misclassified group contributions (money leaving the
  // user, into a group pool) as deposits, since their stored amount is also
  // positive. Only two directions actually exist; default unknown types to
  // "in" is safer than silently mislabeling withdrawals as deposits.
  const isDeposit = MONEY_IN_TYPES.has(type) || (!MONEY_OUT_TYPES.has(type) && amount > 0);
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
          <span className="pending-pill mt-1">Pending</span>
        )}
      </div>
    </div>
  );
}
