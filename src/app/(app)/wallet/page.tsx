"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { LoadingState, ErrorState, EmptyState } from "@/components/yield";
import { formatRelativeTime } from "@/lib/format";
import {
  ArrowUpRight, ArrowDownLeft, Plus, Send, RefreshCw,
  Copy, Eye, EyeOff, Wallet, Info, Building2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  direction: "credit" | "debit";
  status: string;
  description: string | null;
  reference: string;
  created_at: string;
}

interface FundingDetails {
  provisioned: boolean;
  account?: {
    account_number: string;
    account_name: string;
    bank_name: string;
    bank_code?: string;
  };
  message?: string;
  kyc_level?: string;
}

const fmtNGN = (v: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(v || 0);

export default function WalletPage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const { data: me, isLoading: meLoading } = useMe();
  const walletId = me?.wallet?.id;

  const { data: txData, isLoading: txLoading, error: txError, refetch } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  const { data: fundingDetails, refetch: refetchFunding } = useQuery<FundingDetails>({
    queryKey: ["wallet-funding-details"],
    queryFn: async () => {
      const res = await fetch("/api/wallets/funding-details");
      if (!res.ok) return { provisioned: false, message: "Could not load funding details" };
      return res.json();
    },
  });

  if (meLoading) return <LoadingState message="Loading wallet…" />;
  if (!me?.wallet) {
    return (
      <EmptyState
        title="No wallet yet"
        message="Your wallet will be created automatically when you complete sign-up."
        action={<Link href="/dashboard" className="bg-indigo text-white text-sm font-medium px-4 py-2 rounded-lg inline-block">Go to dashboard</Link>}
      />
    );
  }

  const wallet = me.wallet;
  const transactions = txData?.transactions || [];
  const dva = fundingDetails?.provisioned ? fundingDetails.account : null;

  const copyAccountNumber = () => {
    if (dva?.account_number) {
      navigator.clipboard.writeText(dva.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[22px] text-ink">Wallet</h1>
        <p className="text-[13px] text-ink-soft mt-0.5">Your Agriqcap digital wallet</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* LEFT: Balance + DVA + transactions */}
        <div className="space-y-5">
          {/* HERO BALANCE CARD */}
          <div className="relative bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl overflow-hidden text-white">
            <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-paper/5 pointer-events-none" />
            <div className="absolute right-10 bottom-0 w-28 h-28 rounded-full bg-paper/5 pointer-events-none" />
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-paper/15 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-ochre" />
                  </div>
                  <span className="text-[13px] text-white/70 font-medium">Agriqcap Wallet</span>
                </div>
                <button onClick={() => setBalanceVisible(!balanceVisible)} className="w-8 h-8 rounded-lg bg-paper/10 flex items-center justify-center hover:bg-paper/20 transition" aria-label="Toggle balance">
                  {balanceVisible ? <EyeOff className="w-4 h-4 text-white/70" /> : <Eye className="w-4 h-4 text-white/70" />}
                </button>
              </div>
              <div className="mb-2">
                <p className="text-[11px] text-white/70 uppercase tracking-widest mb-1.5">Available Balance</p>
                <p className="font-mono font-semibold text-[38px] leading-tight tracking-tight">
                  {balanceVisible ? fmtNGN(wallet.available_balance) : "\u20a6 \u2022\u2022\u2022\u2022\u2022\u2022"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 bg-paper/8 rounded-xl p-4 mb-5">
                <div>
                  <p className="text-[12px] text-white/70 uppercase tracking-wider mb-1">Ledger</p>
                  <p className="font-mono font-medium text-[14px] text-white">{balanceVisible ? fmtNGN(wallet.ledger_balance) : "\u2022\u2022\u2022\u2022"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-white/70 uppercase tracking-wider mb-1">Pending</p>
                  <p className="font-mono font-medium text-[14px] text-white">{balanceVisible ? fmtNGN(wallet.pending_balance) : "\u2022\u2022\u2022\u2022"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-white/70 uppercase tracking-wider mb-1">Reserved</p>
                  <p className="font-mono font-medium text-[14px] text-white">{balanceVisible ? fmtNGN(wallet.reserved_balance) : "\u2022\u2022\u2022\u2022"}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Link href="/wallet/deposit" className="flex items-center justify-center gap-2 bg-ochre py-3 rounded-xl hover:opacity-90 transition">
                  <Plus className="w-4 h-4 text-indigo-deep" strokeWidth={2.5} />
                  <span className="text-[13px] font-semibold text-indigo-deep">Add money</span>
                </Link>
                <Link href="/wallet/transfer" className="flex items-center justify-center gap-2 bg-paper/15 py-3 rounded-xl hover:bg-paper/20 transition">
                  <Send className="w-4 h-4 text-white" strokeWidth={2} />
                  <span className="text-[13px] font-medium text-white">Transfer</span>
                </Link>
                <Link href="/wallet/withdraw" className="flex items-center justify-center gap-2 bg-paper/15 py-3 rounded-xl hover:bg-paper/20 transition">
                  <ArrowUpRight className="w-4 h-4 text-white" strokeWidth={2} />
                  <span className="text-[13px] font-medium text-white">Withdraw</span>
                </Link>
              </div>
            </div>
          </div>

          {/* A1: DVA / Account number block */}
          {dva ? (
            <div className="bg-paper border border-line rounded-2xl p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-loam-light flex items-center justify-center">
                  <Building2 className="w-[18px] h-[18px] text-loam" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-[15px] text-ink">Your Agriqcap Account</h3>
                  <p className="text-[12px] text-ink-soft">Transfer to this account to fund your wallet</p>
                </div>
              </div>
              <div className="bg-parchment rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-soft">Account Number</span>
                  <button onClick={copyAccountNumber} className="flex items-center gap-1.5 group">
                    <span className="font-mono font-semibold text-[15px] text-ink">{dva.account_number}</span>
                    <Copy className="w-3.5 h-3.5 text-ink-soft group-hover:text-ink transition" />
                    {copied && <span className="text-[11px] text-loam ml-1">Copied!</span>}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-soft">Account Name</span>
                  <span className="text-[13px] font-medium text-ink">{dva.account_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-soft">Bank</span>
                  <span className="text-[13px] font-medium text-ink">{dva.bank_name}</span>
                </div>
              </div>
              <p className="text-[12px] text-ink-soft mt-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Transfers are automatically detected and credited to your wallet within minutes.</span>
              </p>
            </div>
          ) : (
            <div className="bg-paper border border-line rounded-2xl p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-lg bg-ochre-light flex items-center justify-center">
                  <Building2 className="w-[18px] h-[18px] text-ochre-dim" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-[15px] text-ink">Setting up your account number\u2026</h3>
                  <p className="text-[12px] text-ink-soft">{fundingDetails?.message || "Your funding account is being created."}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => refetchFunding()} className="flex items-center gap-1.5 text-[13px] font-medium text-indigo hover:text-indigo-deep transition">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Check again
                </button>
                {fundingDetails?.kyc_level === "tier_0" && (
                  <Link href="/onboarding" className="text-[13px] font-medium text-ochre-dim hover:text-ochre transition">
                    Verify identity first \u2192
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* TRANSACTION HISTORY */}
          <div className="bg-paper border border-line rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-semibold text-[17px] text-ink">Transaction History</h2>
              <span className="text-[12px] text-ink-soft">{transactions.length} entries</span>
            </div>
            {txLoading ? (
              <LoadingState message="Loading transactions\u2026" />
            ) : txError ? (
              <ErrorState message="Couldn't load transactions" onRetry={() => refetch()} />
            ) : transactions.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-full bg-parchment flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="w-7 h-7 text-ink-soft" strokeWidth={1.5} />
                </div>
                <p className="font-medium text-[15px] text-ink mb-1">No transactions yet</p>
                <p className="text-[13px] text-ink-soft">Your wallet transactions will appear here once you start using Agriqcap.</p>
              </div>
            ) : (
              <div>
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-3.5 border-b border-line last:border-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.direction === "credit" ? "bg-loam" : "bg-clay"}`}>
                      {tx.direction === "credit" ? <ArrowDownLeft className="w-5 h-5 text-white" strokeWidth={2} /> : <ArrowUpRight className="w-5 h-5 text-white" strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[14px] text-ink truncate">{tx.description || tx.transaction_type.replace(/_/g, " ")}</p>
                      <p className="text-[12px] text-ink-soft">{formatRelativeTime(tx.created_at)}</p>
                    </div>
                    <p className={`font-mono text-[14px] font-medium flex-shrink-0 ${tx.direction === "credit" ? "text-loam" : "text-ink"}`}>
                      {tx.direction === "credit" ? "+" : "\u2212"}{fmtNGN(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Wallet-specific content (A3: not duplicate nudge cards) */}
        <div className="space-y-4">
          <div className="bg-paper border border-line rounded-2xl p-4">
            <h3 className="font-display font-semibold text-[14px] text-ink mb-3">How wallet funding works</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-loam-light flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-loam">1</span>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">Transfer money to your Agriqcap account number from any Nigerian bank.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-loam-light flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-loam">2</span>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">Safe Haven detects the transfer and credits your wallet automatically.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-loam-light flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-loam">3</span>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">Use your wallet balance to save, borrow, or withdraw to your bank.</p>
              </div>
            </div>
          </div>
          <div className="bg-paper border border-line rounded-2xl p-4">
            <h3 className="font-display font-semibold text-[14px] text-ink mb-3">Wallet summary</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">Status</span>
                <span className="text-[13px] font-medium text-loam capitalize">{wallet.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">Total transactions</span>
                <span className="text-[13px] font-medium text-ink">{transactions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">Currency</span>
                <span className="text-[13px] font-medium text-ink">NGN</span>
              </div>
            </div>
          </div>
          <div className="bg-parchment rounded-xl p-3 border border-line">
            <p className="text-[12px] text-ink-soft text-center">Secured by Safe Haven MFB \u2014 CBN-licensed & NDIC-insured</p>
          </div>
        </div>
      </div>
    </div>
  );
}
