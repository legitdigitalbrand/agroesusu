"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  PiggyBank,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  Lock,
  Sparkles,
} from "lucide-react";

import { useMe } from "@/hooks/use-me";
import { Button, LoadingState, ErrorState } from "@/components/yield";

// ════════════════════════════════════════════════════════════
// Move to Savings Page
//
// Lets user move money from their wallet balance into a
// savings pot (AgroFlex, AgroGoal, HarvestLock, or Custom Pot).
// Uses the existing /api/savings/accounts/{id}/deposit endpoint.
// ════════════════════════════════════════════════════════════

const fmtNGN = (v: number) => {
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(v || 0));
  return `${(v || 0) < 0 ? "-" : ""}₦${formatted}`;
};

interface SavingsAccount {
  id: string;
  status: string;
  current_balance: number;
  pot_name?: string | null;
  pot_icon?: string | null;
  pot_color?: string | null;
  product: {
    product_name: string;
    product_code: string;
    product_type: string;
    interest_rate: number;
    lock_period_days: number;
    minimum_deposit: number;
    withdrawal_allowed: boolean;
  };
}

type Stage = "select" | "amount" | "processing" | "success" | "error";

export default function MoveToSavingsPage() {
  const queryClient = useQueryClient();

  const { data: me, isLoading: meLoading, error: meError } = useMe();
  const wallet = me?.wallet;

  const [selectedAccount, setSelectedAccount] = useState<SavingsAccount | null>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [amount, setAmount] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch savings accounts
  const {
    data: savingsData,
    isLoading: savingsLoading,
    error: savingsError,
  } = useQuery<{ accounts: SavingsAccount[] }>({
    queryKey: ["savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) throw new Error("Failed to load savings accounts");
      return res.json();
    },
  });

  const savingsAccounts = (savingsData?.accounts || []).filter(
    (a) => a.status === "active" || a.status === "pending"
  );

  if (meLoading || savingsLoading)
    return <LoadingState message="Loading your savings accounts…" />;

  if (meError || !me)
    return <ErrorState message="Couldn't load your wallet details" />;

  if (!wallet)
    return <ErrorState message="No active wallet found" />;

  if (savingsError)
    return (
      <ErrorState
        message="Couldn't load your savings accounts. Please try again."
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["savings-accounts"] })}
      />
    );

  const walletBalance = wallet.available_balance || 0;

  // ─── Helpers ───
  const getAccountLabel = (acct: SavingsAccount) =>
    acct.pot_name || acct.product?.product_name || "Savings Pot";

  const getAccountIcon = (acct: SavingsAccount) => {
    const type = acct.product?.product_type;
    if (type === "fixed_deposit") return Lock;
    if (type === "goal") return Sparkles;
    return PiggyBank;
  };

  // ─── Deposit mutation ───
  const handleDeposit = async () => {
    if (!selectedAccount) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setErrorMsg("Enter a valid amount");
      return;
    }
    if (amt > walletBalance) {
      setErrorMsg(
        `Your wallet balance is ${fmtNGN(walletBalance)}. Fund your wallet first.`
      );
      return;
    }

    const minDeposit = selectedAccount.product?.minimum_deposit || 0;
    if (minDeposit > 0 && amt < minDeposit) {
      setErrorMsg(`Minimum deposit for this pot is ${fmtNGN(minDeposit)}`);
      return;
    }

    setStage("processing");
    setErrorMsg("");

    try {
      const res = await fetch(
        `/api/savings/accounts/${selectedAccount.id}/deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amt,
            description: `Wallet \u2192 ${getAccountLabel(selectedAccount)}`,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to move funds");

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });

      setStage("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to move funds");
      setStage("error");
    }
  };

  const reset = () => {
    setSelectedAccount(null);
    setAmount("");
    setErrorMsg("");
    setStage("select");
  };

  // ─── Success screen ───
  if (stage === "success") {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/wallet"
            className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition"
          >
            <ArrowLeft className="w-4 h-4 text-ink" />
          </Link>
          <h1 className="font-display font-bold text-[20px] text-ink">
            Move to Savings
          </h1>
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-paper border border-line rounded-2xl p-8 text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-16 h-16 rounded-full bg-loam-light flex items-center justify-center mx-auto"
          >
            <Check className="w-8 h-8 text-loam" strokeWidth={2.5} />
          </motion.div>
          <div>
            <h2 className="font-display font-semibold text-lg text-ink">
              Funds Moved Successfully
            </h2>
            <p className="text-sm text-ink-soft mt-1">
              {fmtNGN(parseFloat(amount) || 0)} moved from your wallet to{" "}
              {selectedAccount ? getAccountLabel(selectedAccount) : "savings"}.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/wallet" className="flex-1">
              <Button variant="primary" fullWidth>
                Back to Wallet
              </Button>
            </Link>
            <Button variant="outline" fullWidth onClick={reset}>
              Move More
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Main flow ───
  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/wallet"
          className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition"
        >
          <ArrowLeft className="w-4 h-4 text-ink" />
        </Link>
        <h1 className="font-display font-bold text-[20px] text-ink">
          Move to Savings
        </h1>
      </div>

      {/* Wallet balance card */}
      <div className="bg-paper border border-line rounded-2xl p-4">
        <p className="text-[11px] text-ink-soft mb-1">Wallet Balance</p>
        <p className="font-mono font-semibold text-[22px] text-ink">
          {fmtNGN(walletBalance)}
        </p>
      </div>

      {/* No savings accounts */}
      {savingsAccounts.length === 0 && (
        <div className="bg-paper border border-line rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-ochre-light flex items-center justify-center mx-auto">
            <PiggyBank className="w-6 h-6 text-ochre" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-[18px] text-ink">
              No Savings Pots Yet
            </h2>
            <p className="text-sm text-ink-soft mt-1">
              Open a savings pot first, then you can move money from your wallet
              into it anytime.
            </p>
          </div>
          <Link href="/savings">
            <Button variant="primary">Open a Savings Pot</Button>
          </Link>
        </div>
      )}

      {/* Stage: Select savings account */}
      {savingsAccounts.length > 0 && stage === "select" && (
        <div className="space-y-4">
          <p className="text-[13px] font-medium text-ink">
            Choose a savings pot to fund:
          </p>
          <div className="space-y-3">
            {savingsAccounts.map((acct) => {
              const Icon = getAccountIcon(acct);
              const label = getAccountLabel(acct);
              const rate = acct.product?.interest_rate || 0;
              const balance = acct.current_balance || 0;
              return (
                <button
                  key={acct.id}
                  onClick={() => {
                    setSelectedAccount(acct);
                    setStage("amount");
                  }}
                  className="w-full bg-paper border border-line rounded-2xl p-4 flex items-center gap-3 text-left hover:border-indigo/40 hover:shadow-sm transition group"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-indigo" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[15px] text-ink truncate">
                      {label}
                    </p>
                    <p className="text-[12px] text-ink-soft">
                      Balance: {fmtNGN(balance)}
                      {rate > 0 && ` \u00b7 ${rate}% p.a.`}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-soft group-hover:text-indigo transition shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage: Amount input */}
      {(stage === "amount" || stage === "processing" || stage === "error") &&
        selectedAccount && (
          <AnimatePresence mode="wait">
            <motion.div
              key="amount-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Selected account summary */}
              <div className="bg-paper border border-line rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo/10 flex items-center justify-center shrink-0">
                  {(() => {
                    const Icon = getAccountIcon(selectedAccount);
                    return <Icon className="w-5 h-5 text-indigo" />;
                  })()}
                </div>
                <div className="flex-1">
                  <p className="font-display font-semibold text-[15px] text-ink">
                    {getAccountLabel(selectedAccount)}
                  </p>
                  <p className="text-[12px] text-ink-soft">
                    Balance: {fmtNGN(selectedAccount.current_balance || 0)}
                    {selectedAccount.product?.interest_rate
                      ? ` \u00b7 ${selectedAccount.product.interest_rate}% p.a.`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStage("select");
                    setAmount("");
                    setErrorMsg("");
                  }}
                  className="text-[11px] text-indigo hover:underline shrink-0"
                >
                  Change
                </button>
              </div>

              {/* Flow indicator */}
              <div className="flex items-center gap-2 text-[12px] text-ink-soft">
                <span className="px-2.5 py-1 bg-parchment rounded-lg font-medium">
                  Wallet
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
                <span className="px-2.5 py-1 bg-parchment rounded-lg font-medium">
                  {getAccountLabel(selectedAccount)}
                </span>
              </div>

              {/* Amount input */}
              <div>
                <label className="text-[13px] text-ink-soft font-medium block mb-1.5">
                  Amount to move
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="0"
                  className="w-full px-4 py-3 border border-line rounded-xl text-[24px] font-mono bg-paper text-ink focus:outline-none focus:border-indigo"
                />
                <p className="text-[11px] text-ink-soft mt-1">
                  Available: {fmtNGN(walletBalance)}
                </p>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {[1000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() =>
                      setAmount(String(Math.min(amt, walletBalance)))
                    }
                    disabled={amt > walletBalance}
                    className="flex-1 py-2.5 border border-line rounded-lg text-[13px] text-ink-soft hover:bg-parchment transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {fmtNGN(amt)}
                  </button>
                ))}
                {walletBalance > 0 && (
                  <button
                    onClick={() => setAmount(String(walletBalance))}
                    className="flex-1 py-2.5 border border-indigo/30 rounded-lg text-[13px] text-indigo font-medium hover:bg-indigo/5 transition"
                  >
                    Max
                  </button>
                )}
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="bg-clay-light/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-clay shrink-0 mt-0.5" />
                  <p className="text-[13px] text-clay">{errorMsg}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => {
                    setStage("select");
                    setAmount("");
                    setErrorMsg("");
                  }}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={
                    stage === "processing" ||
                    !amount ||
                    parseFloat(amount) <= 0
                  }
                  onClick={handleDeposit}
                  leftIcon={
                    stage === "processing" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )
                  }
                >
                  {stage === "processing" ? "Moving\u2026" : "Move to Savings"}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
    </div>
  );
}
