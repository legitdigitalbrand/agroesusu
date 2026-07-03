import Link from "next/link";
import { BalanceCard } from "@/components/ui/balance-card";
import { GoalCard } from "@/components/ui/goal-card";
import { TransactionRow } from "@/components/ui/transaction-row";
import { Plus, Bell, ArrowRight } from "lucide-react";

// Mock data — will be replaced with real API calls
const mockData = {
  user: { name: "Chinedu" },
  balance: { totalBalance: 127500, totalSaved: 185000, totalWithdrawn: 57500 },
  goals: [
    {
      id: "1",
      name: "Planting Season Inputs",
      targetAmount: 150000,
      currentAmount: 90000,
      unlockDate: "2026-09-15",
    },
    {
      id: "2",
      name: "Tractor Fund",
      targetAmount: 200000,
      currentAmount: 50000,
      unlockDate: "2026-12-31",
    },
  ],
  transactions: [
    {
      type: "deposit" as const,
      amount: 20000,
      description: "Deposit to Planting Season",
      status: "completed" as const,
      date: "2026-07-02T14:30:00",
    },
    {
      type: "interest" as const,
      amount: 320,
      description: "Interest on Flex Savings",
      status: "completed" as const,
      date: "2026-07-01T00:00:00",
    },
    {
      type: "deposit" as const,
      amount: 10000,
      description: "Deposit to Tractor Fund",
      status: "completed" as const,
      date: "2026-06-28T09:15:00",
    },
    {
      type: "withdrawal" as const,
      amount: 15000,
      description: "Withdrawal from Flex Savings",
      status: "completed" as const,
      date: "2026-06-25T16:45:00",
    },
  ],
};

export default function DashboardPage() {
  const { user, balance, goals, transactions } = mockData;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
            <p className="text-sm text-stone-500">Good afternoon,</p>
            <h1 className="text-xl font-semibold text-stone-900">{user.name} 👋</h1>
        </div>
        <button className="relative w-10 h-10 rounded-full bg-brand-gray flex items-center justify-center hover:bg-stone-200 transition-colors">
          <Bell className="w-4.5 h-4.5 text-stone-600" />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-brand-lime ring-2 ring-white" />
        </button>
      </header>

      {/* Balance Card */}
      <BalanceCard
        totalBalance={balance.totalBalance}
        totalSaved={balance.totalSaved}
        totalWithdrawn={balance.totalWithdrawn}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Link
          href="/deposit"
          className="flex items-center justify-center gap-2 bg-brand-gold text-stone-900 rounded-xl py-3.5 font-semibold text-sm hover:brightness-95 transition-all"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Deposit
        </Link>
        <Link
          href="/withdraw"
          className="flex items-center justify-center gap-2 bg-white border border-brand-border text-stone-700 rounded-xl py-3.5 font-semibold text-sm hover:bg-stone-50 transition-colors"
        >
          Withdraw
        </Link>
      </div>

      {/* Active Goals */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-stone-900">Active Goals</h2>
          <Link
            href="/save"
            className="flex items-center gap-1 text-xs font-medium text-brand-green hover:gap-2 transition-all"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              id={goal.id}
              name={goal.name}
              targetAmount={goal.targetAmount}
              currentAmount={goal.currentAmount}
              unlockDate={goal.unlockDate}
            />
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-stone-900">Recent Activity</h2>
          <Link
            href="/transactions"
            className="flex items-center gap-1 text-xs font-medium text-brand-green hover:gap-2 transition-all"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="bg-white border border-brand-border rounded-2xl px-4">
          {transactions.map((txn, i) => (
            <TransactionRow key={i} {...txn} />
          ))}
        </div>
      </section>
    </div>
  );
}
