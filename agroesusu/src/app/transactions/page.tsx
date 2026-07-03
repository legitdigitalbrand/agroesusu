import { TransactionRow } from "@/components/ui/transaction-row";
import { Filter } from "lucide-react";

const mockTransactions = [
  { type: "deposit" as const, amount: 20000, description: "Deposit to Planting Season", status: "completed" as const, date: "2026-07-02T14:30:00" },
  { type: "interest" as const, amount: 320, description: "Interest on Flex Savings", status: "completed" as const, date: "2026-07-01T00:00:00" },
  { type: "deposit" as const, amount: 10000, description: "Deposit to Tractor Fund", status: "completed" as const, date: "2026-06-28T09:15:00" },
  { type: "withdrawal" as const, amount: 15000, description: "Withdrawal from Flex Savings", status: "completed" as const, date: "2026-06-25T16:45:00" },
  { type: "deposit" as const, amount: 5000, description: "Deposit to Flex Savings", status: "completed" as const, date: "2026-06-20T11:00:00" },
  { type: "deposit" as const, amount: 30000, description: "Deposit to Planting Season", status: "completed" as const, date: "2026-06-15T13:30:00" },
  { type: "withdrawal" as const, amount: 25000, description: "Withdrawal from Flex Savings", status: "completed" as const, date: "2026-06-10T10:00:00" },
  { type: "deposit" as const, amount: 10000, description: "Deposit to Flex Savings", status: "completed" as const, date: "2026-06-05T08:45:00" },
];

export default function TransactionsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Activity</h1>
          <p className="text-sm text-stone-500 mt-0.5">All your savings transactions</p>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-brand-gray rounded-lg px-3 py-2 hover:bg-stone-200">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-brand-border rounded-xl p-3.5">
          <p className="text-[11px] text-stone-400 uppercase tracking-wide font-medium">Total In</p>
          <p className="text-base font-semibold text-stone-900 mt-1 tabular-nums">+₦75,320</p>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-3.5">
          <p className="text-[11px] text-stone-400 uppercase tracking-wide font-medium">Total Out</p>
          <p className="text-base font-semibold text-stone-900 mt-1 tabular-nums">−₦40,000</p>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-3.5">
          <p className="text-[11px] text-stone-400 uppercase tracking-wide font-medium">Net</p>
          <p className="text-base font-semibold text-brand-green mt-1 tabular-nums">+₦35,320</p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white border border-brand-border rounded-2xl px-4">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wide pt-4 pb-1">July 2026</p>
        {mockTransactions.slice(0, 2).map((txn, i) => (
          <TransactionRow key={i} {...txn} />
        ))}
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wide pt-4 pb-1">June 2026</p>
        {mockTransactions.slice(2).map((txn, i) => (
          <TransactionRow key={i + 2} {...txn} />
        ))}
      </div>
    </div>
  );
}
