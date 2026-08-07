"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { LoadingState, ErrorState, Card, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, ProgressRing, MoneyText, StatusBadge } from "@/components/yield";
import { ArrowLeft, AlertCircle, Plus, ArrowUpRight, PiggyBank, Calendar, Target, Edit3, Archive, Trash2, TrendingUp, Lock } from "lucide-react";
import Link from "next/link";

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
const fmtRate = (rate: number) => rate.toFixed(1).replace(/\.0$/, "");
const fmtDate = (d?: string | null) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
};

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

interface AccountDetail {
  id: string;
  status: string;
  current_balance: number;
  interest_earned: number;
  target_amount: number | null;
  maturity_date: string | null;
  opened_at: string | null;
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
    goal_id: string;
  };
  product: {
    product_name: string;
    product_code: string;
    product_type: string;
    interest_rate: number;
    interest_method: string;
    term_days: number | null;
    interest_cadence: string;
    lock_period_days: number;
    early_withdrawal_penalty_rate: number;
    minimum_deposit: number;
    withdrawal_allowed: boolean;
  };
  product_terms_snapshot?: {
    interest_rate: number;
    interest_method: string;
    interest_cadence: string;
    lock_period_days: number;
  };
}

export default function SavingsAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;
  const queryClient = useQueryClient();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showEditTargetModal, setShowEditTargetModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: account, isLoading, error, refetch } = useQuery<AccountDetail>({
    queryKey: ["savings-account", accountId],
    queryFn: async () => {
      const res = await fetch(`/api/savings/accounts/${accountId}`);
      if (!res.ok) throw new Error("Failed to load account");
      const data = await res.json();
      return data.account || data;
    },
  });

  const { data: me } = useQuery<{ wallet?: { id: string; available_balance: number } }>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return {};
      return res.json();
    },
  });

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await fetch(`/api/savings/pots/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pot_name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setShowRenameModal(false);
    },
  });

  // Edit target mutation
  const editTargetMutation = useMutation({
    mutationFn: async (data: { target_amount?: number; target_date?: string | null; monthly_target?: number | null }) => {
      const res = await fetch(`/api/savings/pots/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update target");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setShowEditTargetModal(false);
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/savings/pots/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      router.push("/savings");
    },
  });

  // Delete mutation — permanently removes the goal (only if balance is zero)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/savings/pots/${accountId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      router.push("/savings");
    },
  });

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`/api/savings/accounts/${accountId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, wallet_id: me?.wallet?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deposit failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setShowDepositModal(false);
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`/api/savings/accounts/${accountId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, wallet_id: me?.wallet?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setShowWithdrawModal(false);
    },
  });

  if (isLoading) return <LoadingState message="Loading account details…" />;
  if (error || !account) return <ErrorState message="Couldn't load account details" onRetry={() => refetch()} />;

  const product = account.product;
  const productType = product?.product_type || "flexible";
  const productName = product?.product_name || "Savings";
  const rate = product?.interest_rate || account.product_terms_snapshot?.interest_rate || 0;
  const isGoal = account.goal_enabled || false;
  const isFixedDeposit = productType === "fixed_deposit";
  const walletBalance = me?.wallet?.available_balance || 0;

  const balance = account.current_balance || 0;
  const goal = account.goal;
  const displayName = isGoal ? (goal?.name || account.pot_name || productName) : productName;
  const target = goal?.target || 0;
  const progress = goal?.progress || 0;
  const targetDate = goal?.target_date;
  const monthlyTarget = goal?.monthly_target || null;
  const milestone = getMilestone(progress);
  const insight = getInsight(progress, balance, target, monthlyTarget);
  const exceeded = target > 0 && balance > target;
  const remaining = target > 0 ? Math.max(0, target - balance) : 0;
  const goalAchieved = target > 0 && balance >= target;

  // Fixed deposit specific
  const daysRemaining = account.maturity_date
    ? Math.max(0, Math.ceil((new Date(account.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isMatured = account.status === "matured" || (isFixedDeposit && daysRemaining <= 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Back link */}
      <Link href="/savings" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition">
        <ArrowLeft className="w-4 h-4" /> Back to Savings
      </Link>

      {/* Header Card */}
      <Card variant="light" padding="lg">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-parchment border border-line shrink-0">
              {isFixedDeposit ? <Lock className="w-6 h-6 text-indigo" /> : isGoal ? <Target className="w-6 h-6 text-loam" /> : <PiggyBank className="w-6 h-6 text-indigo" />}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-ink leading-tight">{displayName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={account.status} />
                <span className="text-xs text-ink-soft">{fmtRate(rate)}% p.a.</span>
              </div>
            </div>
          </div>
          {isGoal && (
            <div className="flex flex-col gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => setShowRenameModal(true)}>
                Rename
              </Button>
            </div>
          )}
        </div>

        {/* Goal: Progress Ring + Details */}
        {isGoal && target > 0 && (
          <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
            <ProgressRing progress={progress} size={120} strokeWidth={10} label={`${progress}%`} sublabel="complete" variant="indigo" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Current Balance</p>
                <MoneyText amount={balance} size="2xl" />
              </div>
              {remaining > 0 && (
                <div>
                  <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Remaining</p>
                  <p className="font-display text-lg font-semibold text-ink">{fmtNGN(remaining)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Target</p>
                <p className="font-display text-lg font-semibold text-ink">{fmtNGN(target)}</p>
              </div>
              {targetDate && (
                <div className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <Calendar className="w-4 h-4" />
                  <span>Target: {fmtDate(targetDate)}</span>
                </div>
              )}
              {monthlyTarget && (
                <div>
                  <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Monthly Goal</p>
                  <p className="text-sm font-semibold text-ink">{fmtNGN(monthlyTarget)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Non-goal Flexible: Balance only */}
        {!isGoal && !isFixedDeposit && (
          <div className="mb-6">
            <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Available Balance</p>
            <MoneyText amount={balance} size="2xl" />
          </div>
        )}

        {/* Fixed Deposit: Balance + maturity info (no progress bar) */}
        {isFixedDeposit && (
          <div className="mb-6 space-y-3">
            <div>
              <p className="text-xs text-ink-soft uppercase font-medium tracking-wider">Balance</p>
              <MoneyText amount={balance} size="2xl" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Interest Rate</span>
              <span className="font-semibold text-ink">{fmtRate(rate)}% p.a.</span>
            </div>
            {daysRemaining > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Days Remaining</span>
                <span className="font-semibold text-ink">{daysRemaining} days</span>
              </div>
            )}
            {account.maturity_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Maturity Date</span>
                <span className="font-semibold text-ink">{fmtDate(account.maturity_date)}</span>
              </div>
            )}
            {isMatured && (
              <p className="text-sm text-loam font-medium">🎉 Matured — ready to withdraw</p>
            )}
          </div>
        )}

        {/* Progress Bar (goal only) */}
        {isGoal && target > 0 && (
          <div className="mb-6">
            <div className="h-3 rounded-full bg-parchment border border-line/60 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? "bg-loam" : "bg-indigo"}`} style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-ink-soft">{fmtNGN(balance)} of {fmtNGN(target)}</span>
              <span className="font-semibold text-ink">{progress}%</span>
            </div>
            {goalAchieved && (
              <p className="text-sm text-loam font-medium mt-1">
                {exceeded ? `🎉 Goal Achieved — Exceeded by ${fmtNGN(balance - target)}` : "🎉 Goal Achieved"}
              </p>
            )}
          </div>
        )}

        {/* Milestone + Insight (goal only) */}
        {isGoal && milestone && (
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-parchment border border-line/60">
              <span className="text-lg">{milestone.emoji}</span>
              <span className="text-sm font-semibold text-ink">{milestone.label}</span>
            </div>
            {insight && (
              <div className="px-3 py-2 rounded-xl bg-parchment border border-line/60 text-sm text-ink-soft">
                {insight}
              </div>
            )}
          </div>
        )}

        {/* Interest Earned */}
        {(account.interest_earned || 0) > 0 && (
          <div className="flex items-center gap-2 text-sm mb-6">
            <TrendingUp className="w-4 h-4 text-loam" />
            <span className="text-ink-soft">Interest earned: </span>
            <span className="font-semibold text-loam">{fmtNGN(account.interest_earned || 0)}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowDepositModal(true)}>
            Deposit
          </Button>
          <Button variant="outline" leftIcon={<ArrowUpRight className="w-4 h-4" />} onClick={() => setShowWithdrawModal(true)} disabled={account.status === "pending"}>
            Withdraw
          </Button>
          {isGoal && (
            <>
              <Button variant="ghost" leftIcon={<Edit3 className="w-4 h-4" />} onClick={() => setShowEditTargetModal(true)}>
                Edit Target
              </Button>
              <Button variant="ghost" leftIcon={<Archive className="w-4 h-4" />} onClick={() => setShowArchiveModal(true)}>
                Archive
              </Button>
              <Button variant="ghost" leftIcon={<Trash2 className="w-4 h-4" />} onClick={() => setShowDeleteModal(true)} className="text-destructive hover:text-destructive">
                Delete
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Deposit Modal */}
      {showDepositModal && (
        <DepositModal
          onClose={() => setShowDepositModal(false)}
          onDeposit={(amt) => depositMutation.mutate(amt)}
          isLoading={depositMutation.isPending}
          error={depositMutation.error?.message}
          walletBalance={walletBalance}
          accountName={displayName}
        />
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <WithdrawModal
          onClose={() => setShowWithdrawModal(false)}
          onWithdraw={(amt) => withdrawMutation.mutate(amt)}
          isLoading={withdrawMutation.isPending}
          error={withdrawMutation.error?.message}
          maxAmount={balance}
          accountName={displayName}
        />
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <RenameModal
          currentName={displayName}
          onClose={() => setShowRenameModal(false)}
          onRename={(name) => renameMutation.mutate(name)}
          isLoading={renameMutation.isPending}
          error={renameMutation.error?.message}
        />
      )}

      {/* Edit Target Modal */}
      {showEditTargetModal && (
        <EditTargetModal
          currentTarget={target}
          currentDate={targetDate ?? null}
          currentMonthly={monthlyTarget ?? null}
          onClose={() => setShowEditTargetModal(false)}
          onSave={(data) => editTargetMutation.mutate(data)}
          isLoading={editTargetMutation.isPending}
          error={editTargetMutation.error?.message}
        />
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <Dialog open onOpenChange={(open) => !open && setShowArchiveModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Archive {displayName}?</DialogTitle>
              <DialogDescription>
                Archived goals are hidden from your dashboard but remain in your transaction history and statements.
              </DialogDescription>
            </DialogHeader>
            {balance > 0 ? (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Cannot archive a goal with a positive balance. Please withdraw all funds first.</span>
              </div>
            ) : archiveMutation.error ? (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{archiveMutation.error.message}</span>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">This goal has a zero balance and can be safely archived.</p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowArchiveModal(false)} disabled={archiveMutation.isPending}>Cancel</Button>
              <Button variant="primary" onClick={() => archiveMutation.mutate()} isLoading={archiveMutation.isPending} disabled={balance > 0}>
                Archive
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Dialog open onOpenChange={(open) => !open && setShowDeleteModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {displayName}?</DialogTitle>
              <DialogDescription>
                This permanently removes the goal and all its data. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {balance > 0 ? (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Cannot delete a goal with a positive balance. Please withdraw all funds first.</span>
              </div>
            ) : deleteMutation.error ? (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteMutation.error.message}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ink-soft">This goal has a zero balance and can be permanently deleted.</p>
                <p className="text-xs text-destructive font-medium">All transaction history for this goal will be lost.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button variant="primary" onClick={() => deleteMutation.mutate()} isLoading={deleteMutation.isPending} disabled={balance > 0} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Deposit Modal ────────────────────────────────────────
function DepositModal({ onClose, onDeposit, isLoading, error, walletBalance, accountName }: {
  onClose: () => void;
  onDeposit: (amount: number) => void;
  isLoading: boolean;
  error?: string;
  walletBalance: number;
  accountName: string;
}) {
  const [amount, setAmount] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit to {accountName}</DialogTitle>
          <DialogDescription>Move money from your wallet to this savings account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-ink-soft">Wallet Balance</span>
            <span className="font-semibold text-ink">{fmtNGN(walletBalance)}</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
            </div>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" onClick={() => onDeposit(parseFloat(amount))} isLoading={isLoading} disabled={!amount || parseFloat(amount) <= 0}>Deposit</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Withdraw Modal ───────────────────────────────────────
function WithdrawModal({ onClose, onWithdraw, isLoading, error, maxAmount, accountName }: {
  onClose: () => void;
  onWithdraw: (amount: number) => void;
  isLoading: boolean;
  error?: string;
  maxAmount: number;
  accountName: string;
}) {
  const [amount, setAmount] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from {accountName}</DialogTitle>
          <DialogDescription>Move money from this savings account to your wallet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-ink-soft">Available Balance</span>
            <span className="font-semibold text-ink">{fmtNGN(maxAmount)}</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
            </div>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" onClick={() => onWithdraw(parseFloat(amount))} isLoading={isLoading} disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount}>Withdraw</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rename Modal ─────────────────────────────────────────
function RenameModal({ currentName, onClose, onRename, isLoading, error }: {
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [newName, setNewName] = useState(currentName);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Goal</DialogTitle>
          <DialogDescription>Change the name of this savings goal. Your account ID, balance, and transactions remain unchanged.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">New Name</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 50))} autoFocus maxLength={50} className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
            <p className="text-[11px] text-ink-soft mt-1">{newName.length}/50 characters</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" onClick={() => onRename(newName.trim())} isLoading={isLoading} disabled={newName.trim().length < 2 || newName.trim() === currentName}>Rename</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Target Modal ────────────────────────────────────
function EditTargetModal({ currentTarget, currentDate, currentMonthly, onClose, onSave, isLoading, error }: {
  currentTarget: number;
  currentDate: string | null;
  currentMonthly: number | null;
  onClose: () => void;
  onSave: (data: { target_amount?: number; target_date?: string | null; monthly_target?: number | null }) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [target, setTarget] = useState(String(currentTarget || ""));
  const [date, setDate] = useState(currentDate ? currentDate.split("T")[0] : "");
  const [monthly, setMonthly] = useState(currentMonthly ? String(currentMonthly) : "");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
          <DialogDescription>Update your target amount, target date, or monthly target. Progress recalculates automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Target Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Target Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Monthly Target</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
              <input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
            </div>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" onClick={() => onSave({ target_amount: parseFloat(target) || undefined, target_date: date || null, monthly_target: monthly ? parseFloat(monthly) : null })} isLoading={isLoading} disabled={!target || parseFloat(target) <= 0}>Save Changes</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
