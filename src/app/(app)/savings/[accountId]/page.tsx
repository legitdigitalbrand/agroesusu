"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { LoadingState, ErrorState, Card, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, ProgressRing, MoneyText, StatusBadge } from "@/components/yield";
import { ArrowLeft, AlertCircle, Plus, ArrowUpRight, PiggyBank, Calendar, Target, Edit3, Archive, Trash2, TrendingUp, Lock, CheckCircle2, Info, Wallet, RefreshCw } from "lucide-react";
import Link from "next/link";

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
const fmtRate = (rate: number) => rate.toFixed(1).replace(/\.0$/, "");
const fmtDate = (d?: string | null) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
};

// Result-card payloads for the deposit/withdraw modals (2026-09-11)
interface DepositResultDetails {
  required?: number;
  available?: number;
  shortfall?: number;
  minimum?: number;
}
interface DepositResultCard {
  ok: boolean;
  amount: number;
  message?: string;
  code?: string;
  details?: DepositResultDetails;
  transactionRef?: string;
}
interface WithdrawResultCard {
  ok: boolean;
  amount: number;
  message?: string;
  transactionRef?: string;
}

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
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showEarlyWithdrawWarning, setShowEarlyWithdrawWarning] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState<WithdrawResultCard | null>(null);
  // Success/failure result cards shown inside the deposit & withdraw modals
  // (2026-09-11): users get explicit confirmation that money moved from/to
  // the Main Wallet, or a clear failure card with the next step.
  const [depositResult, setDepositResult] = useState<DepositResultCard | null>(null);
  const [withdrawResult, setWithdrawResult] = useState<WithdrawResultCard | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showEditTargetModal, setShowEditTargetModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const searchParams = useSearchParams();

  const { data: account, isLoading, error, refetch } = useQuery<AccountDetail>({
    queryKey: ["savings-account", accountId],
    queryFn: async () => {
      const res = await fetch(`/api/savings/accounts/${accountId}`);
      if (!res.ok) throw new Error("Failed to load account");
      const data = await res.json();
      return data.account || data;
    },
  });


  const openDepositModal = () => { setDepositResult(null); depositMutation.reset(); setShowDepositModal(true); };
  const openWithdrawModal = () => { setWithdrawResult(null); withdrawMutation.reset(); setShowWithdrawModal(true); };

  // Deep-link support: /savings/<id>?action=deposit|withdraw opens the
  // corresponding modal straight away (used by the savings cards).
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !account) return;
    const action = searchParams.get("action");
    if (action === "deposit" && account.status !== "closed") {
      setDepositResult(null);
      setShowDepositModal(true);
      deepLinkHandled.current = true;
    } else if (action === "withdraw" && (account.status === "active" || account.status === "matured")) {
      setWithdrawResult(null);
      setShowWithdrawModal(true);
      deepLinkHandled.current = true;
    }
  }, [account, searchParams]);

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

  // One-click close-out: withdraw the full balance back to the wallet, then
  // archive, then permanently delete the goal. Used by the delete dialog when
  // the goal still holds funds — saves the user a 3-step manual flow.
  const withdrawAndDeleteMutation = useMutation({
    mutationFn: async () => {
      const fullBalance = account?.current_balance || 0;
      if (fullBalance <= 0) throw new Error("Nothing to withdraw");

      const withdrawRes = await fetch(`/api/savings/accounts/${accountId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: fullBalance, wallet_id: me?.wallet?.id }),
      });
      const withdrawData = await withdrawRes.json();
      if (!withdrawRes.ok) throw new Error(withdrawData.error || "Failed to withdraw balance");

      const archiveRes = await fetch(`/api/savings/pots/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const archiveData = await archiveRes.json();
      if (!archiveRes.ok) throw new Error(archiveData.error || "Failed to archive goal");

      const deleteRes = await fetch(`/api/savings/pots/${accountId}`, {
        method: "DELETE",
      });
      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) throw new Error(deleteData.error || "Failed to delete goal");
      return deleteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
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
      if (!res.ok) {
        // Structured failure: the API returns code + details (e.g. the
        // wallet pre-check's required/available/shortfall).
        throw Object.assign(new Error(data.error || "Deposit failed"), {
          code: data.code,
          details: data.details,
        });
      }
      return data;
    },
    onSuccess: (data, amount) => {
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setDepositResult({ ok: true, amount, transactionRef: data.transaction_reference });
    },
    onError: (err: Error & { code?: string; details?: DepositResultDetails }) => {
      setDepositResult({
        ok: false,
        amount: 0,
        message: err.message,
        code: err.code,
        details: err.details,
      });
    },
  });

  // Emergency early-exit mutation (locked fixed deposits): full principal back,
  // accrued interest forfeited, deposit closed.
  const emergencyWithdrawMutation = useMutation({
    mutationFn: async () => {
      if (!account?.current_balance) throw new Error("No balance to withdraw");
      const res = await fetch(`/api/savings/accounts/${accountId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: account?.current_balance ?? 0, wallet_id: me?.wallet?.id, emergency: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Emergency withdrawal failed");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEmergencyResult({ ok: true, amount: account?.current_balance || 0, transactionRef: data.transaction_reference });
    },
    onError: (err: Error) => {
      setEmergencyResult({ ok: false, amount: 0, message: err.message });
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
    onSuccess: (data, amount) => {
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setWithdrawResult({ ok: true, amount, transactionRef: data.transaction_reference });
    },
    onError: (err: Error) => {
      setWithdrawResult({ ok: false, amount: 0, message: err.message });
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
            {!isMatured && account.status === "active" && daysRemaining > 0 && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <p className="text-xs text-amber-800 leading-relaxed">
                  Need this money early? An emergency withdrawal returns your <span className="font-semibold">full principal</span> to your wallet immediately and closes the deposit — all accrued interest is forfeited.
                </p>
                <button
                  onClick={() => setShowEmergencyModal(true)}
                  className="text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                >
                  Emergency withdrawal →
                </button>
              </div>
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
          <Button variant="secondary" leftIcon={<Plus className="w-4 h-4" />} onClick={openDepositModal}>
            Deposit
          </Button>
          {/* Unmatured fixed deposit: warn about forfeited interest BEFORE the
              amount/confirm flow. Flexible & matured accounts withdraw freely. */}
          <Button
            variant="outline"
            leftIcon={<ArrowUpRight className="w-4 h-4" />}
            onClick={() => {
              if (isFixedDeposit && !isMatured && account.status === "active") {
                setShowEarlyWithdrawWarning(true);
              } else {
                openWithdrawModal();
              }
            }}
            disabled={account.status === "pending"}
          >
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
          result={depositResult}
          onRetry={() => { setDepositResult(null); depositMutation.reset(); }}
          walletBalance={walletBalance}
          accountName={displayName}
        />
      )}

      {/* Early Withdrawal Warning — fixed deposit not yet matured (2026-09-11):
           warn that withdrawing now forfeits accrued interest, BEFORE any
           amount entry or confirmation. */}
      {showEarlyWithdrawWarning && (
        <Dialog open onOpenChange={(open) => !open && setShowEarlyWithdrawWarning(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-loam" /> Withdraw before maturity?
              </DialogTitle>
              <DialogDescription>
                This fixed deposit has not matured yet — about {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-xl bg-parchment border border-line space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-ink-soft">Interest earned so far</span>
                  <span className="font-semibold text-loam">{fmtNGN(account.interest_earned || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-ink-soft">Interest if you keep saving to maturity</span>
                  <span className="font-semibold text-ink">{fmtRate(rate)}% p.a.</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-amber-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Withdrawing now <span className="font-semibold">forfeits all accrued interest ({fmtNGN(account.interest_earned || 0)})</span>. Only your principal returns to your Main Wallet, and the deposit closes.</span>
              </div>
              <DialogFooter>
                <Button variant="primary" onClick={() => setShowEarlyWithdrawWarning(false)}>Keep Saving</Button>
                <Button variant="ghost" onClick={() => { setShowEarlyWithdrawWarning(false); setEmergencyResult(null); emergencyWithdrawMutation.reset(); setShowEmergencyModal(true); }}>
                  Proceed to Withdraw
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Emergency Withdrawal Confirm Modal */}
      {showEmergencyModal && (
        <Dialog open onOpenChange={(open) => !open && setShowEmergencyModal(false)}>
          <DialogContent className="max-w-md">
            {emergencyResult ? (
              <div className="space-y-4 pt-2">
                {emergencyResult.ok ? (
                  <div className="pt-4 pb-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-ink">Withdrawal Successful</h3>
                    <p className="mt-2 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">{fmtNGN(emergencyResult.amount)}</span> principal returned to your{" "}
                      <span className="font-semibold text-ink">Main Wallet</span>. Accrued interest was forfeited and the deposit is now closed.
                    </p>
                    {emergencyResult.transactionRef && (
                      <p className="mt-2 text-[11px] text-ink-soft">Ref: {emergencyResult.transactionRef}</p>
                    )}
                    <div className="mt-5 flex justify-center gap-2">
                      <Button variant="ghost" onClick={() => { setShowEmergencyModal(false); setEmergencyResult(null); }}>Close</Button>
                      <Link href="/wallet">
                        <Button variant="primary" leftIcon={<Wallet className="w-4 h-4" />}>View Wallet</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 pb-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-200">
                      <AlertCircle className="w-7 h-7 text-red-600" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-ink">Withdrawal Not Completed</h3>
                    <p className="mt-2 text-sm text-ink-soft">{emergencyResult.message}</p>
                    <div className="mt-5 flex justify-center gap-2">
                      <Button variant="ghost" onClick={() => { setShowEmergencyModal(false); setEmergencyResult(null); }}>Close</Button>
                      <Button variant="primary" onClick={() => { setEmergencyResult(null); emergencyWithdrawMutation.reset(); }} leftIcon={<RefreshCw className="w-4 h-4" />}>Try Again</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <>
            <DialogHeader>
              <DialogTitle>Emergency Withdrawal</DialogTitle>
              <DialogDescription>
                Close this fixed deposit early and move your principal to your wallet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
                You are withdrawing <span className="font-semibold">before maturity</span> ({daysRemaining} days remaining). Your <span className="font-semibold">full principal is returned</span> — no penalty fee — but <span className="font-semibold">all accrued interest is forfeited</span>. This closes the deposit and cannot be undone.
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-soft">Principal returned to wallet</span>
                <span className="font-semibold text-ink">{fmtNGN(balance)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-soft">Interest forfeited</span>
                <span className="font-semibold text-ink">{fmtNGN(account.interest_earned || 0)}</span>
              </div>
              {emergencyWithdrawMutation.error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{(emergencyWithdrawMutation.error as Error).message}</span>
                </div>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowEmergencyModal(false)} disabled={emergencyWithdrawMutation.isPending}>Cancel</Button>
                <Button variant="primary" onClick={() => emergencyWithdrawMutation.mutate()} isLoading={emergencyWithdrawMutation.isPending}>
                  Confirm Emergency Withdrawal
                </Button>
              </DialogFooter>
            </div>
            </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <WithdrawModal
          onClose={() => setShowWithdrawModal(false)}
          onWithdraw={(amt) => withdrawMutation.mutate(amt)}
          isLoading={withdrawMutation.isPending}
          result={withdrawResult}
          onRetry={() => { setWithdrawResult(null); withdrawMutation.reset(); }}
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
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    This goal still holds {fmtNGN(balance)}. You can move the full balance back to your
                    wallet and delete the goal in one step below.
                  </span>
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => withdrawAndDeleteMutation.mutate()}
                  isLoading={withdrawAndDeleteMutation.isPending}
                  disabled={withdrawAndDeleteMutation.isPending}
                >
                  Withdraw {fmtNGN(balance)} to wallet & Delete
                </Button>
                {withdrawAndDeleteMutation.error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{(withdrawAndDeleteMutation.error as Error).message}</span>
                  </div>
                )}
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
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleteMutation.isPending || withdrawAndDeleteMutation.isPending}>Cancel</Button>
              {balance <= 0 && (
                <Button variant="primary" onClick={() => deleteMutation.mutate()} isLoading={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  Delete Permanently
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Deposit Modal ────────────────────────────────────────
// Shows success/failure result cards (2026-09-11): deposits always move
// money FROM the Main Wallet — say so explicitly, warn before submitting
// when the wallet can't cover the amount, and on insufficient balance
// guide the user to top up and try again.
function DepositModal({ onClose, onDeposit, isLoading, result, onRetry, walletBalance, accountName }: {
  onClose: () => void;
  onDeposit: (amount: number) => void;
  isLoading: boolean;
  result: DepositResultCard | null;
  onRetry: () => void;
  walletBalance: number;
  accountName: string;
}) {
  const [amount, setAmount] = useState("");
  const parsed = parseFloat(amount) || 0;
  const insufficient = parsed > 0 && parsed > walletBalance;

  // ── Result card view ──
  if (result) {
    if (result.ok) {
      return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-md">
            <div className="pt-6 pb-2 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink">Deposit Successful</h3>
              <p className="mt-2 text-sm text-ink-soft">
                <span className="font-semibold text-ink">{fmtNGN(result.amount)}</span> moved from your{" "}
                <span className="font-semibold text-ink">Main Wallet</span> to{" "}
                <span className="font-semibold text-ink">{accountName}</span>.
              </p>
              {result.transactionRef && (
                <p className="mt-2 text-[11px] text-ink-soft">Ref: {result.transactionRef}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Link href="/wallet" className="w-full sm:w-auto">
                <Button variant="primary" className="w-full sm:w-auto" leftIcon={<Wallet className="w-4 h-4" />}>View Wallet</Button>
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
    // Failure card
    const walletShortfall = result.code === "insufficient_wallet_balance";
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <div className="pt-6 pb-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-200">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink">Deposit Not Completed</h3>
            <p className="mt-2 text-sm text-ink-soft">{result.message}</p>
            {walletShortfall && result.details?.shortfall != null && (
              <p className="mt-2 text-sm font-semibold text-ink">
                Top up your Main Wallet with at least {fmtNGN(result.details.shortfall)} and try again.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {walletShortfall ? (
              <Link href="/wallet/deposit" className="w-full sm:w-auto">
                <Button variant="primary" className="w-full sm:w-auto" leftIcon={<Plus className="w-4 h-4" />}>Top Up Wallet</Button>
              </Link>
            ) : (
              <Button variant="primary" onClick={onRetry} leftIcon={<RefreshCw className="w-4 h-4" />}>Try Again</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Amount entry view ──
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit to {accountName}</DialogTitle>
          <DialogDescription>
            Transfers instantly from your <span className="font-medium text-ink">Main Wallet</span> to this savings account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="p-3 rounded-xl bg-parchment border border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo" strokeWidth={1.8} />
              <span className="text-xs font-medium text-ink-soft">Main Wallet Balance</span>
            </div>
            <span className="text-sm font-semibold text-ink">{fmtNGN(walletBalance)}</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Amount to move</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
            </div>
            {insufficient && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-amber-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Your Main Wallet does not have enough for this deposit — short by{" "}
                  <span className="font-semibold">{fmtNGN(parsed - walletBalance)}</span>.{" "}
                  <Link href="/wallet/deposit" className="underline font-semibold">Top up your wallet</Link> and try again.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" onClick={() => onDeposit(parsed)} isLoading={isLoading} disabled={!amount || parsed <= 0 || insufficient}>Deposit</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Withdraw Modal ───────────────────────────────────────
// Success/failure result cards (2026-09-11): withdrawals move money to the
// Main Wallet — confirm it explicitly with the amount and new balances.
function WithdrawModal({ onClose, onWithdraw, isLoading, result, onRetry, maxAmount, accountName }: {
  onClose: () => void;
  onWithdraw: (amount: number) => void;
  isLoading: boolean;
  result: WithdrawResultCard | null;
  onRetry: () => void;
  maxAmount: number;
  accountName: string;
}) {
  const [amount, setAmount] = useState("");
  const parsed = parseFloat(amount) || 0;

  // ── Result card view ──
  if (result) {
    if (result.ok) {
      return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-md">
            <div className="pt-6 pb-2 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink">Withdrawal Successful</h3>
              <p className="mt-2 text-sm text-ink-soft">
                <span className="font-semibold text-ink">{fmtNGN(result.amount)}</span> moved from{" "}
                <span className="font-semibold text-ink">{accountName}</span> to your{" "}
                <span className="font-semibold text-ink">Main Wallet</span>.
              </p>
              {result.transactionRef && (
                <p className="mt-2 text-[11px] text-ink-soft">Ref: {result.transactionRef}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Link href="/wallet" className="w-full sm:w-auto">
                <Button variant="primary" className="w-full sm:w-auto" leftIcon={<Wallet className="w-4 h-4" />}>View Wallet</Button>
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <div className="pt-6 pb-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-200">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink">Withdrawal Not Completed</h3>
            <p className="mt-2 text-sm text-ink-soft">{result.message}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={onRetry} leftIcon={<RefreshCw className="w-4 h-4" />}>Try Again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Amount entry view ──
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from {accountName}</DialogTitle>
          <DialogDescription>
            Moves money from this savings account to your{" "}
            <span className="font-medium text-ink">Main Wallet</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-ink-soft">Available Balance</span>
            <span className="font-semibold text-ink">{fmtNGN(maxAmount)}</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Amount to move</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₦</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" onClick={() => onWithdraw(parsed)} isLoading={isLoading} disabled={!amount || parsed <= 0 || parsed > maxAmount}>Withdraw</Button>
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
