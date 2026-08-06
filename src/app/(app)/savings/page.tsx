"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ScreenHeader,
  Card,
  Button,
  StatusBadge,
  MoneyText,
  ProgressRing,
  LoadingState,
  ErrorState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/yield";
import {
  PiggyBank,
  AlertCircle,
  TrendingUp,
  Calendar,
  Wallet,
  ChevronRight,
  Plus,
  Target,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Savings Page — Flexible Savings + Savings Pots
// Only two options shown to customers:
//   1. Flexible Savings (instant deposit/withdraw, no goal)
//   2. Savings Pot (goal-based, with progress tracking)
// ════════════════════════════════════════════════════════════

const fmtNGN = (v: number) => {
  const n = v || 0;
  return `${n < 0 ? "-" : ""}₦${Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
};
const fmtRate = (rate: number) => (rate || 0).toFixed(1).replace(/\.0$/, "");
const fmtDate = (d?: string | null) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
};

// ── Templates ──
const POT_TEMPLATES = [
  { icon: "🏠", label: "House Rent", name: "House Rent" },
  { icon: "🚜", label: "Farm Expansion", name: "Farm Expansion" },
  { icon: "🎓", label: "Education", name: "Education" },
  { icon: "💼", label: "Business", name: "Business" },
  { icon: "🚗", label: "Vehicle", name: "Vehicle" },
  { icon: "🩺", label: "Emergency Fund", name: "Emergency Fund" },
  { icon: "🌴", label: "Vacation", name: "Vacation" },
  { icon: "✨", label: "Custom", name: "" },
];

// ── Milestones ──
function getMilestone(pct: number): { emoji: string; label: string } | null {
  if (pct >= 100) return { emoji: "🎉", label: "Goal Achieved" };
  if (pct >= 75) return { emoji: "🌳", label: "Almost There" };
  if (pct >= 50) return { emoji: "🌿", label: "Great Progress" };
  if (pct >= 25) return { emoji: "🌱", label: "Getting Started" };
  return null;
}

function getInsight(pct: number, balance: number, target: number, monthlyTarget: number | null): string | null {
  const remaining = target - balance;
  if (remaining <= 0 || pct >= 100) return null;
  if (monthlyTarget && monthlyTarget > 0) {
    if (pct >= 90) return "One more deposit completes this goal.";
    return `Deposit ${fmtNGN(monthlyTarget)} this month to stay on track.`;
  }
  return null;
}

export interface SavingsAccount {
  id: string;
  status: string;
  current_balance?: number;
  interest_earned?: number;
  target_amount?: number;
  maturity_date?: string | null;
  opened_at?: string | null;
  created_at: string;
  pot_name?: string | null;
  pot_icon?: string | null;
  pot_color?: string | null;
  type?: string;
  goal?: {
    name: string;
    target: number;
    progress: number;
    target_date: string | null;
    monthly_target: number | null;
    goal_status: string;
  };
  product?: {
    product_name: string;
    product_code: string;
    product_type: string;
    interest_rate: number;
    interest_method: string;
    term_days: number | null;
  };
}

export default function SavingsPage() {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showPotWizard, setShowPotWizard] = useState(false);
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading, isError, refetch } = useQuery<{ accounts: SavingsAccount[] }>({
    queryKey: ["savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) throw new Error("Failed to load savings accounts");
      return res.json();
    },
  });

  const rawAccounts = accountsData?.accounts || [];

  // Deduplicate accounts by id
  const seenIds = new Set<string>();
  const allAccounts = rawAccounts.filter((acct) => {
    if (!acct.id || seenIds.has(acct.id)) return false;
    seenIds.add(acct.id);
    return true;
  });

  // Separate Flexible and Pot accounts
  const flexibleAccounts = allAccounts.filter(
    (a) => a.product?.product_type === "flexible" && a.status !== "closed"
  );
  const potAccounts = allAccounts.filter(
    (a) => a.product?.product_type === "custom_pot" && a.status !== "closed"
  );

  // Create pot mutation
  const createPotMutation = useMutation({
    mutationFn: async (data: {
      pot_name: string;
      target_amount: number;
      target_date?: string | null;
      monthly_target?: number | null;
      initial_deposit?: number;
    }) => {
      const res = await fetch("/api/savings/pots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create pot");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setShowPotWizard(false);
      setShowTypeSelector(false);
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading your savings…" />;
  }

  if (isError) {
    return <ErrorState message="Unable to load your savings information." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-8 pb-12">
      <ScreenHeader
        title="Savings"
        subtitle="Grow your money with flexible savings and goal-based pots."
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="dark" padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-white/10">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/70 uppercase font-medium tracking-wider">Total Savings</p>
              <MoneyText amount={allAccounts.reduce((s, a) => s + (a.current_balance || 0), 0)} size="2xl" className="text-white" />
            </div>
          </div>
          <p className="text-xs text-white/60">{allAccounts.filter((a) => a.status === "active").length} active {allAccounts.filter((a) => a.status === "active").length === 1 ? "account" : "accounts"}</p>
        </Card>

        <Card variant="light" padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-parchment border border-line">
              <Target className="w-5 h-5 text-indigo" />
            </div>
            <div>
              <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Savings Pots</p>
              <p className="font-display text-2xl font-bold text-ink">{potAccounts.length}</p>
            </div>
          </div>
          <p className="text-xs text-ink-soft">{potAccounts.filter((a) => (a.goal?.progress || 0) >= 100).length} goals achieved</p>
        </Card>
      </div>

      {/* Open Savings Button */}
      <div className="flex justify-center">
        <Button
          variant="primary"
          size="lg"
          leftIcon={<Plus className="w-5 h-5" />}
          onClick={() => setShowTypeSelector(true)}
        >
          Open Savings
        </Button>
      </div>

      {/* Flexible Savings Section */}
      {flexibleAccounts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Flexible Savings</h2>
              <p className="text-xs text-ink-soft mt-0.5">Save and withdraw anytime.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flexibleAccounts.map((acct) => (
              <FlexibleSavingsCard key={acct.id} account={acct} />
            ))}
          </div>
        </section>
      )}

      {/* Savings Pots Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Your Savings Pots</h2>
            <p className="text-xs text-ink-soft mt-0.5">Goal-based savings with progress tracking.</p>
          </div>
          {potAccounts.length > 0 && (
            <Button variant="outline" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowPotWizard(true)}>
              New Pot
            </Button>
          )}
        </div>

        {potAccounts.length === 0 ? (
          <Card variant="light" padding="lg" className="text-center">
            <div className="w-14 h-14 rounded-full bg-parchment border border-line flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-ink-soft" />
            </div>
            <h3 className="font-display text-lg font-semibold text-ink mb-1">No Savings Pots yet</h3>
            <p className="text-sm text-ink-soft mb-4 max-w-sm mx-auto">Create your first savings pot and start tracking progress toward your financial goals.</p>
            <Button variant="secondary" onClick={() => setShowPotWizard(true)}>Create Your First Pot</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {potAccounts.map((acct) => (
              <PotCard key={acct.id} account={acct} />
            ))}
          </div>
        )}
      </section>

      {/* Type Selector Dialog */}
      {showTypeSelector && (
        <Dialog open={showTypeSelector} onOpenChange={(open) => !open && setShowTypeSelector(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Choose Savings Type</DialogTitle>
              <DialogDescription>Select how you want to save.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {/* Flexible */}
              <button
                onClick={() => setShowTypeSelector(false)}
                className="w-full p-4 rounded-2xl border-2 border-line bg-paper text-left transition hover:border-indigo"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2.5 rounded-xl bg-parchment border border-line">
                    <PiggyBank className="w-5 h-5 text-indigo" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink">Flexible Savings</h3>
                    <p className="text-xs text-ink-soft">Save and withdraw anytime.</p>
                  </div>
                </div>
                <span className="inline-block mt-2 text-xs font-semibold text-indigo">Open →</span>
              </button>

              {/* Savings Pot */}
              <button
                onClick={() => {
                  setShowTypeSelector(false);
                  setShowPotWizard(true);
                }}
                className="w-full p-4 rounded-2xl border-2 border-line bg-paper text-left transition hover:border-loam"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2.5 rounded-xl bg-parchment border border-line">
                    <Target className="w-5 h-5 text-loam" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink">Savings Pot</h3>
                    <p className="text-xs text-ink-soft">Create a savings goal and track your progress.</p>
                  </div>
                </div>
                <span className="inline-block mt-2 text-xs font-semibold text-loam">Create →</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Pot Wizard */}
      {showPotWizard && (
        <PotWizard
          onClose={() => setShowPotWizard(false)}
          onCreate={(data) => createPotMutation.mutate(data)}
          isLoading={createPotMutation.isPending}
          error={createPotMutation.error?.message}
        />
      )}
    </div>
  );
}

// ─── Flexible Savings Card ─────────────────────────────────
function FlexibleSavingsCard({ account }: { account: SavingsAccount }) {
  const balance = account.current_balance || 0;
  const interestEarned = account.interest_earned || 0;
  const rate = account.product?.interest_rate || 0;

  return (
    <Card variant="light" padding="md" className="flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-parchment border border-line shrink-0">
              <PiggyBank className="w-5 h-5 text-indigo" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-ink leading-tight">Flexible Savings</h3>
              <p className="text-xs text-ink-soft mt-0.5">{fmtRate(rate)}% p.a.</p>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>

        <div className="mt-2">
          <p className="text-xs text-ink-soft uppercase font-medium tracking-wider mb-1">Available Balance</p>
          <MoneyText amount={balance} size="2xl" />
        </div>

        {interestEarned > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-loam" />
            <span className="text-ink-soft">Interest earned: </span>
            <span className="font-semibold text-loam">{fmtNGN(interestEarned)}</span>
          </div>
        )}
      </div>

      <div className="pt-2 flex items-center gap-2">
        <Link href={`/savings/${account.id}`} className="flex-1">
          <Button variant="outline" size="sm" fullWidth>Deposit</Button>
        </Link>
        <Link href={`/savings/${account.id}`} className="flex-1">
          <Button variant="ghost" size="sm" fullWidth>Withdraw</Button>
        </Link>
        <Link href={`/savings/${account.id}`}>
          <Button variant="ghost" size="sm">Transactions</Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Pot Card ─────────────────────────────────────────────
function PotCard({ account }: { account: SavingsAccount }) {
  const balance = account.current_balance || 0;
  const goal = account.goal;
  const potName = goal?.name || account.pot_name || "Savings Pot";
  const target = goal?.target || 0;
  const progress = goal?.progress || 0;
  const targetDate = fmtDate(goal?.target_date);
  const monthlyTarget = goal?.monthly_target || null;
  const rate = account.product?.interest_rate || 0;
  const milestone = getMilestone(progress);
  const insight = getInsight(progress, balance, target, monthlyTarget);
  const exceeded = balance > target && target > 0;

  return (
    <Card variant="light" padding="md" className="flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-parchment border border-line shrink-0">
              <Target className="w-5 h-5 text-loam" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-ink leading-tight">{potName}</h3>
              <p className="text-xs text-ink-soft mt-0.5">{fmtRate(rate)}% p.a.</p>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>

        {/* Balance + Progress Ring */}
        <div className="flex items-end justify-between gap-4 mt-2">
          <div>
            <p className="text-xs text-ink-soft uppercase font-medium tracking-wider mb-1">Current Balance</p>
            <MoneyText amount={balance} size="2xl" />
          </div>
          {target > 0 && (
            <ProgressRing
              progress={progress}
              size={64}
              strokeWidth={6}
              label={`${progress}%`}
              sublabel="target"
              variant="indigo"
            />
          )}
        </div>

        {/* Progress Bar */}
        {target > 0 && (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-parchment border border-line/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, progress)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${progress >= 100 ? "bg-loam" : "bg-indigo"}`}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-ink-soft">{fmtNGN(balance)} of {fmtNGN(target)}</span>
              <span className="font-semibold text-ink">{progress}%</span>
            </div>
            {exceeded && (
              <p className="text-xs text-loam font-medium mt-1">Exceeded goal by {fmtNGN(balance - target)}</p>
            )}
          </div>
        )}

        {/* Target Date */}
        {targetDate && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Target: {targetDate}</span>
          </div>
        )}

        {/* Milestone */}
        {milestone && (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span>{milestone.emoji}</span>
            <span className="font-semibold text-ink">{milestone.label}</span>
          </div>
        )}

        {/* Insight */}
        {insight && (
          <div className="mt-2 p-2.5 rounded-lg bg-parchment border border-line/60 text-xs text-ink-soft">
            {insight}
          </div>
        )}
      </div>

      <div className="pt-2 flex items-center gap-2">
        <Link href={`/savings/${account.id}`} className="flex-1">
          <Button variant="outline" size="sm" fullWidth>Deposit</Button>
        </Link>
        <Link href={`/savings/${account.id}`} className="flex-1">
          <Button variant="ghost" size="sm" fullWidth>Withdraw</Button>
        </Link>
        <Link href={`/savings/${account.id}`}>
          <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>Details</Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Pot Wizard (5-step) ──────────────────────────────────
function PotWizard({
  onClose,
  onCreate,
  isLoading,
  error,
}: {
  onClose: () => void;
  onCreate: (data: {
    pot_name: string;
    target_amount: number;
    target_date?: string | null;
    monthly_target?: number | null;
    initial_deposit?: number;
  }) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [step, setStep] = useState(1);
  const [potName, setPotName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("");

  const canSubmit =
    potName.trim().length >= 2 &&
    potName.length <= 50 &&
    parseFloat(targetAmount) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onCreate({
      pot_name: potName.trim(),
      target_amount: parseFloat(targetAmount),
      target_date: targetDate || null,
      monthly_target: monthlyTarget ? parseFloat(monthlyTarget) : null,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Savings Pot</DialogTitle>
          <DialogDescription>Set a goal and track your progress.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-indigo" : "bg-parchment border border-line/60"}`}
            />
          ))}
        </div>

        <div className="space-y-4">
          {/* Step 1: Pot Name */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="text-xs font-semibold text-ink block mb-2">Savings Pot Name</label>
              <input
                type="text"
                value={potName}
                onChange={(e) => setPotName(e.target.value.slice(0, 50))}
                placeholder="e.g. Farm Expansion"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
                maxLength={50}
                autoFocus
              />
              <p className="text-[11px] text-ink-soft mt-2">{potName.length}/50 characters</p>

              {/* Templates */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-ink mb-2">Quick Templates</p>
                <div className="grid grid-cols-4 gap-2">
                  {POT_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => t.name && setPotName(t.name)}
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-line bg-parchment hover:border-indigo transition text-center"
                    >
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-[10px] text-ink-soft leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="primary" size="sm" onClick={() => setStep(2)} disabled={potName.trim().length < 2}>
                  Next
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Target Amount */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="text-xs font-semibold text-ink block mb-2">Target Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-ink-soft mt-2">Must be greater than zero.</p>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" size="sm" onClick={() => setStep(3)} disabled={!targetAmount || parseFloat(targetAmount) <= 0}>
                  Next
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Target Date (Optional) */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="text-xs font-semibold text-ink block mb-2">Target Date (Optional)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
              />
              <p className="text-[11px] text-ink-soft mt-2">When do you want to reach this goal? Skip if not sure.</p>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Back</Button>
                <Button variant="primary" size="sm" onClick={() => setStep(4)}>Next</Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Monthly Target (Optional) */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="text-xs font-semibold text-ink block mb-2">Monthly Target (Optional)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
                <input
                  type="number"
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
                />
              </div>
              <p className="text-[11px] text-ink-soft mt-2">Used for progress insights only. Skip if not sure.</p>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(3)}>Back</Button>
                <Button variant="primary" size="sm" onClick={() => setStep(5)}>Next</Button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Review & Create */}
          {step === 5 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-parchment border border-line space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Pot Name</span>
                    <span className="text-ink font-semibold">{potName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Target Amount</span>
                    <span className="text-ink font-semibold">{fmtNGN(parseFloat(targetAmount) || 0)}</span>
                  </div>
                  {targetDate && (
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Target Date</span>
                      <span className="text-ink font-semibold">{fmtDate(targetDate)}</span>
                    </div>
                  )}
                  {monthlyTarget && (
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Monthly Target</span>
                      <span className="text-ink font-semibold">{fmtNGN(parseFloat(monthlyTarget) || 0)}</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(4)} disabled={isLoading}>Back</Button>
                <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
                  Create Savings Pot
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
