"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { LoadingState, ErrorState } from "@/components/yield";
import {
  ArrowLeft, Lock, Check, AlertCircle, Plus, ArrowUpRight,
  PiggyBank, Calendar, Info, X,
} from "lucide-react";
import Link from "next/link";

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
const fmtRate = (rate: number) => rate.toFixed(1).replace(/\.0$/, "");

// ════════════════════════════════════════════════════════════
// Savings Account Detail Page
//
// Shows everything about a savings account:
//   - Account name, type, status
//   - Current balance, available balance, locked balance
//   - Interest earned, interest rate, next interest date
//   - Deposit and Withdraw buttons
//   - Transaction history
//   - Lock period info (for fixed deposits)
// ════════════════════════════════════════════════════════════

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

  if (isLoading) return <LoadingState message="Loading account details…" />;
  if (error || !account) return <ErrorState message="Couldn't load account details" onRetry={() => refetch()} />;

  const product = account.product;
  const productType = product?.product_type || 'flexible';
  const productName = product?.product_name || "Savings";
  const rate = product?.interest_rate || account.product_terms_snapshot?.interest_rate || 0;
  const isFixed = productType === 'fixed_deposit';
  const isLocked = isFixed && account.status === 'active';
  const isMatured = account.status === 'matured';
  const isPending = account.status === 'pending';
  const walletBalance = me?.wallet?.available_balance || 0;

  const daysRemaining = account.maturity_date
    ? Math.max(0, Math.ceil((new Date(account.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const canWithdraw = (product?.withdrawal_allowed || !isFixed) && !isPending;
  const canDeposit = walletBalance > 0 && !isMatured;

  return (
    <div className="space-y-5 max-w-2xl">
      <Link href="/savings" className="flex items-center gap-1 text-[14px] text-ink-soft hover:text-ink transition">
        <ArrowLeft className="w-4 h-4" /> Back to savings
      </Link>

      {/* Account hero card */}
      <div className="relative bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl overflow-hidden text-white">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-paper/5 pointer-events-none" />
        <div className="relative p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-paper/15 flex items-center justify-center">
                {isFixed ? <Lock className="w-[18px] h-[18px] text-ochre" /> : <PiggyBank className="w-[18px] h-[18px] text-ochre" />}
              </div>
              <div>
                <p className="text-[15px] font-semibold">{productName}</p>
                <p className="text-[12px] text-white/70 capitalize">{productType.replace(/_/g, " ")} · {account.status}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[16px] text-ochre font-semibold">{fmtRate(rate)}%</p>
              <p className="text-[11px] text-white/60">p.a.</p>
            </div>
          </div>

          {/* Balance */}
          <p className="text-[12px] text-white/70 mb-1">Current Balance</p>
          <p className="font-mono font-bold text-[32px] leading-tight">{fmtNGN(account.current_balance || 0)}</p>

          {/* Interest earned */}
          <div className="flex gap-4 mt-3">
            <div>
              <p className="text-[10px] text-white/60">Interest Earned</p>
              <p className="font-mono text-[14px] text-white/90">{fmtNGN(account.interest_earned || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/60">Interest Type</p>
              <p className="font-mono text-[14px] text-white/90 capitalize">{product?.interest_method || 'compound'}</p>
            </div>
          </div>

          {/* Maturity date for fixed deposits */}
          {isLocked && daysRemaining !== null && (
            <div className="mt-3 bg-paper/10 rounded-xl p-3 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-ochre flex-shrink-0" />
              <div>
                <p className="text-[12px] text-white/90 font-medium">
                  Matures in {daysRemaining} days
                </p>
                <p className="text-[11px] text-white/60">
                  {new Date(account.maturity_date!).toLocaleDateString("en-NG", { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          )}

          {isMatured && (
            <div className="mt-3 bg-ochre/20 rounded-xl p-3 flex items-center gap-2.5">
              <Check className="w-4 h-4 text-ochre flex-shrink-0" />
              <p className="text-[12px] text-white font-medium">Matured — you can withdraw anytime</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => canDeposit ? setShowDepositModal(true) : router.push("/wallet/deposit")}
              className="flex items-center justify-center gap-2 bg-ochre py-3 rounded-xl flex-1 hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4 text-indigo-deep" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-indigo-deep">Deposit</span>
            </button>
            {canWithdraw && (
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex items-center justify-center gap-2 bg-paper/15 py-3 rounded-xl flex-1 hover:bg-paper/20 transition"
              >
                <ArrowUpRight className="w-4 h-4 text-white" strokeWidth={2} />
                <span className="text-[13px] font-medium text-white">Withdraw</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account details grid */}
      <div className="bg-paper border border-line rounded-2xl p-5">
        <h3 className="font-display font-semibold text-[15px] text-ink mb-3">Account Details</h3>
        <div className="space-y-2.5 text-[14px]">
          <DetailRow label="Account type" value={productName} />
          <DetailRow label="Status" value={(account.status || "pending").charAt(0).toUpperCase() + (account.status || "pending").slice(1)} />
          <DetailRow label="Interest rate" value={`${fmtRate(rate)}% p.a.`} />
          <DetailRow label="Interest method" value={product?.interest_method === 'compound' ? 'Compound' : 'Flat'} />
          <DetailRow label="Interest cadence" value={product?.interest_cadence || 'daily'} />
          {isFixed && (
            <>
              <DetailRow label="Lock period" value={`${product?.lock_period_days || 90} days`} />
              {product?.early_withdrawal_penalty_rate > 0 && (
                <DetailRow label="Early exit penalty" value={`${product.early_withdrawal_penalty_rate}% of balance`} />
              )}
            </>
          )}
          <DetailRow label="Minimum deposit" value={fmtNGN(product?.minimum_deposit || 100)} />
          {account.opened_at && (
            <DetailRow label="Opened on" value={new Date(account.opened_at).toLocaleDateString("en-NG", { day: 'numeric', month: 'short', year: 'numeric' })} />
          )}
        </div>
      </div>

      {/* Contextual help */}
      <div className="bg-parchment rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-ink-soft flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-ink mb-1">How this account works</p>
            <p className="text-[13px] text-ink-soft">
              {isFixed
                ? `Your money is locked for ${product?.lock_period_days || 90} days and earns ${fmtRate(rate)}% interest per annum. You can withdraw early but will pay a ${product?.early_withdrawal_penalty_rate || 0}% penalty. Interest is calculated at maturity.`
                : `You can deposit and withdraw anytime. Your balance earns ${fmtRate(rate)}% interest per annum, calculated daily and compounded. There is no minimum balance requirement.`}
            </p>
          </div>
        </div>
      </div>

      {/* Deposit modal */}
      {showDepositModal && (
        <FundsModal
          type="deposit"
          account={account}
          walletBalance={walletBalance}
          onClose={() => setShowDepositModal(false)}
          accountId={accountId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
            queryClient.invalidateQueries({ queryKey: ["me"] });
            setShowDepositModal(false);
          }}
        />
      )}

      {/* Withdraw modal */}
      {showWithdrawModal && (
        <FundsModal
          type="withdraw"
          account={account}
          walletBalance={walletBalance}
          onClose={() => setShowWithdrawModal(false)}
          accountId={accountId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] });
            queryClient.invalidateQueries({ queryKey: ["me"] });
            setShowWithdrawModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Detail row ───
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}

// ─── Deposit/Withdraw Modal ───
function FundsModal({
  type, account, walletBalance, onClose, accountId, onSuccess,
}: {
  type: "deposit" | "withdraw";
  account: AccountDetail;
  walletBalance: number;
  onClose: () => void;
  accountId: string;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (type === "deposit" && amt > walletBalance) {
      setError(`Your wallet balance is ${fmtNGN(walletBalance)}. Fund your wallet first.`);
      return;
    }

    if (type === "withdraw" && amt > (account.current_balance || 0)) {
      setError("Amount exceeds your savings balance");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = type === "deposit"
        ? `/api/savings/accounts/${accountId}/deposit`
        : `/api/savings/accounts/${accountId}/withdraw`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${type}`);

      setSuccess(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const isDeposit = type === "deposit";
  const available = isDeposit ? walletBalance : (account.current_balance || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-indigo-deep/40 backdrop-blur-sm p-4">
      <div className="bg-paper rounded-2xl border border-line w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-loam-light flex items-center justify-center">
              {isDeposit ? <Plus className="h-5 w-5 text-indigo" /> : <ArrowUpRight className="h-5 w-5 text-indigo" />}
            </div>
            <div>
              <p className="font-display font-semibold text-[16px] text-ink">
                {isDeposit ? "Move to " + (account.pot_name || "Savings") : "Withdraw from " + (account.pot_name || "Savings")}
              </p>
              <p className="text-[12px] text-ink-soft">
                {isDeposit ? `From your Wallet → ${account.pot_name || "Savings pot"}` : `From ${account.pot_name || "Savings"} → your Wallet`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-parchment transition">
            <X className="w-5 h-5 text-ink-soft" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-loam-light flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-loam" />
            </div>
            <h3 className="font-display font-semibold text-[18px] text-ink mb-2">
              {isDeposit ? "Deposited!" : "Withdrawn!"}
            </h3>
            <p className="text-[14px] text-ink-soft mb-4">
              {fmtNGN(parseFloat(amount) || 0)} has been {isDeposit ? "moved from your wallet to your savings" : "moved from your savings to your wallet"}.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Available balance */}
            <div className="bg-parchment rounded-xl p-3.5">
              <p className="text-[12px] text-ink-soft">
                {isDeposit ? "Wallet balance" : "Available to withdraw"}
              </p>
              <p className="font-mono text-[18px] font-semibold text-ink mt-0.5">{fmtNGN(available)}</p>
            </div>

            {/* Amount input */}
            <div>
              <label className="text-[13px] text-ink-soft font-medium block mb-1.5">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 border border-line rounded-xl text-[20px] font-mono bg-paper text-ink focus:outline-none focus:border-indigo"
              />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2">
              {[1000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(String(amt))}
                  className="flex-1 py-2 border border-line rounded-lg text-[13px] text-ink-soft hover:bg-parchment transition"
                >
                  {fmtNGN(amt)}
                </button>
              ))}
            </div>

            {/* Flow explanation */}
            <div className="flex items-center gap-2 text-[12px] text-ink-soft">
              <span className="px-2 py-1 bg-parchment rounded">{isDeposit ? "Wallet" : "Savings"}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span className="px-2 py-1 bg-parchment rounded">{isDeposit ? "Savings" : "Wallet"}</span>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
                <p className="text-[13px] text-clay">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-deep border-t-transparent rounded-full animate-spin" />
                  {isDeposit ? "Depositing…" : "Withdrawing…"}
                </>
              ) : (
                isDeposit ? `Deposit ${amount ? fmtNGN(parseFloat(amount)) : ""}` : `Withdraw ${amount ? fmtNGN(parseFloat(amount)) : ""}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
