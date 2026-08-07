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
  Lock,
  Users,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Savings Page — Flexible Savings + Fixed Deposit + Esusu
// Goal tracking is part of Flexible Savings, not a separate product.
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
  goal_enabled?: boolean;
  goal_date?: string | null;
  monthly_target?: number | null;
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
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showFlexibleStyleSelector, setShowFlexibleStyleSelector] = useState(false);
  const [showGoalWizard, setShowGoalWizard] = useState(false);
  const [showFixedDepositSelector, setShowFixedDepositSelector] = useState(false);
  const [selectedFdProduct, setSelectedFdProduct] = useState<string | null>(null);
  const [showFdAmount, setShowFdAmount] = useState(false);
  const [fdAmount, setFdAmount] = useState("");
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading, isError, refetch } = useQuery<{ accounts: SavingsAccount[] }>({
    queryKey: ["savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) throw new Error("Failed to load savings accounts");
      return res.json();
    },
  });

  // Fetch products for Fixed Deposit options
  const { data: productsData } = useQuery<{ products: { id: string; product_code: string; product_name: string; product_type: string; interest_rate: number; term_days: number | null; lock_period_days: number; minimum_deposit: number }[] }>({
    queryKey: ["savings-products"],
    queryFn: async () => {
      const res = await fetch("/api/savings/products");
      if (!res.ok) return { products: [] };
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

  // Separate accounts by product type
  const flexibleAccounts = allAccounts.filter(
    (a) => a.product?.product_type === "flexible" && a.status !== "closed"
  );
  const fixedDepositAccounts = allAccounts.filter(
    (a) => a.product?.product_type === "fixed_deposit" && a.status !== "closed"
  );

  // Within flexible: split into general vs goal-enabled
  const goalFlexible = flexibleAccounts.filter((a) => a.goal_enabled);

  // Create goal-based flexible savings mutation
  const createGoalMutation = useMutation({
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
      if (!res.ok) throw new Error(result.error || "Failed to create savings goal");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setShowGoalWizard(false);
      setShowFlexibleStyleSelector(false);
      setShowProductSelector(false);
    },
  });

  // Create general flexible savings mutation
  const createFlexibleMutation = useMutation({
    mutationFn: async () => {
      // Find the FLEX product
      const flexProduct = productsData?.products?.find((p) => p.product_type === "flexible");
      if (!flexProduct) throw new Error("Flexible Savings product not found");

      const res = await fetch("/api/savings/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: flexProduct.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to open savings account");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setShowFlexibleStyleSelector(false);
      setShowProductSelector(false);
    },
  });

  // Create fixed deposit mutation
  const createFdMutation = useMutation({
    mutationFn: async (data: { product_id: string; initial_deposit: number }) => {
      const res = await fetch("/api/savings/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: data.product_id,
          initial_deposit: data.initial_deposit,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to open fixed deposit");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setShowFdAmount(false);
      setShowFixedDepositSelector(false);
      setShowProductSelector(false);
      setSelectedFdProduct(null);
      setFdAmount("");
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading your savings…" />;
  }

  if (isError) {
    return <ErrorState message="Unable to load your savings information." onRetry={() => refetch()} />;
  }

  // Filter FD products for selector
  const fdProducts = productsData?.products?.filter((p) => p.product_type === "fixed_deposit") || [];

  return (
    <div className="space-y-8 pb-12">
      <ScreenHeader
        title="Savings"
        subtitle="Grow your money with flexible savings, fixed deposits, and goals."
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
          <p className="text-xs text-white/60">{allAccounts.filter((a) => a.status === "active" || a.status === "pending").length} active {allAccounts.filter((a) => a.status === "active" || a.status === "pending").length === 1 ? "account" : "accounts"}</p>
        </Card>

        <Card variant="light" padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-parchment border border-line">
              <Target className="w-5 h-5 text-indigo" />
            </div>
            <div>
              <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Savings Goals</p>
              <p className="font-display text-2xl font-bold text-ink">{goalFlexible.length}</p>
            </div>
          </div>
          <p className="text-xs text-ink-soft">{goalFlexible.filter((a) => (a.goal?.progress || 0) >= 100).length} goals achieved</p>
        </Card>
      </div>

      {/* Open Savings Button */}
      <div className="flex justify-center">
        <Button
          variant="primary"
          size="lg"
          leftIcon={<Plus className="w-5 h-5" />}
          onClick={() => setShowProductSelector(true)}
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

      {/* Fixed Deposit Section */}
      {fixedDepositAccounts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Fixed Deposit</h2>
              <p className="text-xs text-ink-soft mt-0.5">Earn higher returns by locking your funds.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fixedDepositAccounts.map((acct) => (
              <FixedDepositCard key={acct.id} account={acct} />
            ))}
          </div>
        </section>
      )}

      {/* Product Selector Dialog */}
      {showProductSelector && (
        <Dialog open={showProductSelector} onOpenChange={(open) => !open && setShowProductSelector(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Choose Savings Plan</DialogTitle>
              <DialogDescription>Select how you want to save.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {/* Flexible */}
              <button
                onClick={() => {
                  setShowProductSelector(false);
                  setShowFlexibleStyleSelector(true);
                }}
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
                <span className="inline-block mt-2 text-xs font-semibold text-indigo">Choose →</span>
              </button>

              {/* Fixed Deposit */}
              <button
                onClick={() => {
                  setShowProductSelector(false);
                  setShowFixedDepositSelector(true);
                }}
                className="w-full p-4 rounded-2xl border-2 border-line bg-paper text-left transition hover:border-indigo"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2.5 rounded-xl bg-parchment border border-line">
                    <Lock className="w-5 h-5 text-indigo" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink">Fixed Deposit</h3>
                    <p className="text-xs text-ink-soft">Earn higher returns by locking your funds.</p>
                  </div>
                </div>
                <span className="inline-block mt-2 text-xs font-semibold text-indigo">Choose →</span>
              </button>

              {/* Esusu — Coming Soon */}
              <div className="w-full p-4 rounded-2xl border-2 border-line bg-parchment text-left opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2.5 rounded-xl bg-paper border border-line">
                    <Users className="w-5 h-5 text-ink-soft" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink">Esusu</h3>
                    <p className="text-xs text-ink-soft">Coming Soon</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Flexible Style Selector Dialog */}
      {showFlexibleStyleSelector && (
        <Dialog open={showFlexibleStyleSelector} onOpenChange={(open) => !open && setShowFlexibleStyleSelector(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Choose Saving Style</DialogTitle>
              <DialogDescription>How would you like to save?</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {/* General Savings */}
              <button
                onClick={() => createFlexibleMutation.mutate()}
                disabled={createFlexibleMutation.isPending}
                className="w-full p-4 rounded-2xl border-2 border-line bg-paper text-left transition hover:border-indigo disabled:opacity-50"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2.5 rounded-xl bg-parchment border border-line">
                    <PiggyBank className="w-5 h-5 text-indigo" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink">General Savings</h3>
                    <p className="text-xs text-ink-soft">Withdraw anytime.</p>
                  </div>
                </div>
                <span className="inline-block mt-2 text-xs font-semibold text-indigo">
                  {createFlexibleMutation.isPending ? "Creating…" : "Open →"}
                </span>
              </button>

              {/* Savings Goal */}
              <button
                onClick={() => {
                  setShowFlexibleStyleSelector(false);
                  setShowGoalWizard(true);
                }}
                className="w-full p-4 rounded-2xl border-2 border-line bg-paper text-left transition hover:border-loam"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2.5 rounded-xl bg-parchment border border-line">
                    <Target className="w-5 h-5 text-loam" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink">Savings Goal</h3>
                    <p className="text-xs text-ink-soft">Track progress toward a financial target.</p>
                  </div>
                </div>
                <span className="inline-block mt-2 text-xs font-semibold text-loam">Create →</span>
              </button>
            </div>
            {createFlexibleMutation.error && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{createFlexibleMutation.error.message}</span>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Fixed Deposit Term Selector */}
      {showFixedDepositSelector && (
        <Dialog open={showFixedDepositSelector} onOpenChange={(open) => !open && setShowFixedDepositSelector(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Fixed Deposit</DialogTitle>
              <DialogDescription>Choose your lock period.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {fdProducts.length === 0 && (
                <p className="text-sm text-ink-soft text-center py-4">No fixed deposit products available.</p>
              )}
              {fdProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedFdProduct(p.id);
                    setShowFixedDepositSelector(false);
                    setShowFdAmount(true);
                  }}
                  className="w-full p-4 rounded-2xl border-2 border-line bg-paper text-left transition hover:border-indigo"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-parchment border border-line">
                        <Lock className="w-5 h-5 text-indigo" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-base text-ink">{p.product_name}</h3>
                        <p className="text-xs text-ink-soft">{fmtRate(p.interest_rate)}% p.a.</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-indigo">Choose →</span>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Fixed Deposit Amount Entry */}
      {showFdAmount && selectedFdProduct && (
        <Dialog open={showFdAmount} onOpenChange={(open) => !open && setShowFdAmount(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enter Amount</DialogTitle>
              <DialogDescription>How much would you like to lock?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-ink block mb-2">Deposit Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
                  <input
                    type="number"
                    value={fdAmount}
                    onChange={(e) => setFdAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
                  />
                </div>
                <p className="text-[11px] text-ink-soft mt-2">Minimum ₦5,000.</p>
              </div>
              {createFdMutation.error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createFdMutation.error.message}</span>
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setShowFdAmount(false)} disabled={createFdMutation.isPending}>Cancel</Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => createFdMutation.mutate({ product_id: selectedFdProduct, initial_deposit: parseFloat(fdAmount) })}
                  isLoading={createFdMutation.isPending}
                  disabled={!fdAmount || parseFloat(fdAmount) < 5000}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Goal Wizard */}
      {showGoalWizard && (
        <GoalWizard
          onClose={() => setShowGoalWizard(false)}
          onCreate={(data) => createGoalMutation.mutate(data)}
          isLoading={createGoalMutation.isPending}
          error={createGoalMutation.error?.message}
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
  const isGoal = account.goal_enabled || false;
  const goal = account.goal;
  const potName = goal?.name || account.pot_name || "Flexible Savings";
  const target = goal?.target || 0;
  const progress = goal?.progress || 0;
  const targetDate = fmtDate(goal?.target_date);
  const monthlyTarget = goal?.monthly_target || null;
  const milestone = getMilestone(progress);
  const insight = getInsight(progress, balance, target, monthlyTarget);
  const exceeded = balance > target && target > 0;

  return (
    <Card variant="light" padding="md" className="flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-parchment border border-line shrink-0">
              {isGoal ? <Target className="w-5 h-5 text-loam" strokeWidth={1.8} /> : <PiggyBank className="w-5 h-5 text-indigo" strokeWidth={1.8} />}
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-ink leading-tight">{potName}</h3>
              <p className="text-xs text-ink-soft mt-0.5">{fmtRate(rate)}% p.a.</p>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>

        <div className="flex items-end justify-between gap-4 mt-2">
          <div>
            <p className="text-xs text-ink-soft uppercase font-medium tracking-wider mb-1">{isGoal ? "Current Balance" : "Available Balance"}</p>
            <MoneyText amount={balance} size="2xl" />
          </div>
          {isGoal && target > 0 && (
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

        {/* Progress Bar — only for goal-enabled accounts */}
        {isGoal && target > 0 && (
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
              <p className="text-xs text-loam font-medium mt-1">🎉 Goal Achieved — Exceeded by {fmtNGN(balance - target)}</p>
            )}
          </div>
        )}

        {/* Target Date */}
        {isGoal && targetDate && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Target: {targetDate}</span>
          </div>
        )}

        {/* Milestone */}
        {isGoal && milestone && (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span>{milestone.emoji}</span>
            <span className="font-semibold text-ink">{milestone.label}</span>
          </div>
        )}

        {/* Insight */}
        {isGoal && insight && (
          <div className="mt-2 p-2.5 rounded-lg bg-parchment border border-line/60 text-xs text-ink-soft">
            {insight}
          </div>
        )}

        {/* Interest Earned (non-goal) */}
        {!isGoal && interestEarned > 0 && (
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
          <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>Details</Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Fixed Deposit Card ───────────────────────────────────
function FixedDepositCard({ account }: { account: SavingsAccount }) {
  const balance = account.current_balance || 0;
  const rate = account.product?.interest_rate || 0;
  const maturityDate = fmtDate(account.maturity_date);

  // Calculate days remaining
  const daysRemaining = account.maturity_date
    ? Math.max(0, Math.ceil((new Date(account.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isMatured = account.status === "matured" || daysRemaining <= 0;

  return (
    <Card variant="light" padding="md" className="flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-parchment border border-line shrink-0">
              <Lock className="w-5 h-5 text-indigo" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-ink leading-tight">
                {account.product?.product_name || "Fixed Deposit"}
              </h3>
              <p className="text-xs text-ink-soft mt-0.5">{fmtRate(rate)}% p.a.</p>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>

        <div className="mt-2">
          <p className="text-xs text-ink-soft uppercase font-medium tracking-wider mb-1">Balance</p>
          <MoneyText amount={balance} size="2xl" />
        </div>

        {/* Fixed Deposit info — no progress bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">Interest Rate</span>
            <span className="font-semibold text-ink">{fmtRate(rate)}% p.a.</span>
          </div>
          {daysRemaining > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-soft">Days Remaining</span>
              <span className="font-semibold text-ink">{daysRemaining} days</span>
            </div>
          )}
          {maturityDate && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-soft">Maturity Date</span>
              <span className="font-semibold text-ink">{maturityDate}</span>
            </div>
          )}
          {isMatured && (
            <div className="flex items-center gap-1.5 text-xs text-loam font-medium pt-1">
              <span>🎉 Matured — ready to withdraw</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 flex items-center gap-2">
        <Link href={`/savings/${account.id}`} className="flex-1">
          <Button variant="outline" size="sm" fullWidth>Details</Button>
        </Link>
        <Link href={`/savings/${account.id}`}>
          <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>View</Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Milestones & Insights ────────────────────────────────
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

// ─── Goal Wizard (3-step) ─────────────────────────────────
function GoalWizard({
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
          <DialogTitle>Create Savings Goal</DialogTitle>
          <DialogDescription>Set a target and track your progress.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-indigo" : "bg-parchment border border-line/60"}`}
            />
          ))}
        </div>

        <div className="space-y-4">
          {/* Step 1: Goal Name */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="text-xs font-semibold text-ink block mb-2">Goal Name</label>
              <input
                type="text"
                value={potName}
                onChange={(e) => setPotName(e.target.value.slice(0, 50))}
                placeholder="e.g. Emergency Fund"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
                maxLength={50}
                autoFocus
              />
              <p className="text-[11px] text-ink-soft mt-2">{potName.length}/50 characters</p>

              <div className="flex justify-end mt-4">
                <Button variant="primary" size="sm" onClick={() => setStep(2)} disabled={potName.trim().length < 2}>
                  Next
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Target Amount + Date */}
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

              <div className="mt-4">
                <label className="text-xs font-semibold text-ink block mb-2">Target Date (Optional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
                />
              </div>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" size="sm" onClick={() => setStep(3)} disabled={!targetAmount || parseFloat(targetAmount) <= 0}>
                  Next
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Monthly Target (Optional) + Review */}
          {step === 3 && (
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
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-ink-soft mt-2">Used for progress insights only. Skip if not sure.</p>

              {/* Review */}
              <div className="mt-4 p-3.5 rounded-2xl bg-parchment border border-line space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Goal Name</span>
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
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-between mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(2)} disabled={isLoading}>Back</Button>
                <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading} disabled={!canSubmit}>
                  Create Goal
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
