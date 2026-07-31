"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, Check, Loader2, X, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { Button, LoadingState, ErrorState } from "@/components/yield";

const fmtNGN = (v: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(v || 0);

type Step = "bank" | "account" | "verify" | "amount" | "review" | "processing" | "result";

interface NameEnquiryResult {
  sessionId: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

interface WithdrawalResult {
  id: string;
  status: string;
  payment_reference: string;
  amount: number;
  fee: number;
  message?: string;
}

export default function WithdrawPage() {
  const { data: me, isLoading: meLoading, error: meError } = useMe();
  const wallet = me?.wallet;

  const [step, setStep] = useState<Step>("bank");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [nameEnquiry, setNameEnquiry] = useState<NameEnquiryResult | null>(null);
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [withdrawalResult, setWithdrawalResult] = useState<WithdrawalResult | null>(null);
  const [error, setError] = useState("");

  // Nigerian banks list (common ones — Safe Haven supports all Nigerian banks)
  const banks = [
    { code: "044", name: "Access Bank" },
    { code: "035", name: "ALAT by Wema" },
    { code: "011", name: "First Bank of Nigeria" },
    { code: "058", name: "GTBank" },
    { code: "070", name: "Fidelity Bank" },
    { code: "076", name: "Zenith Bank" },
    { code: "033", name: "United Bank for Africa" },
    { code: "232", name: "Sterling Bank" },
    { code: "057", name: "Stanbic IBTC" },
    { code: "311", name: "Cowrywise" },
    { code: "999", name: "Safe Haven MFB" },
    { code: "030", name: "Heritage Bank" },
    { code: "082", name: "Keystone Bank" },
    { code: "221", name: "Stanbic IBTC Bank" },
    { code: "215", name: "Unity Bank" },
    { code: "040", name: "EcoBank" },
    { code: "084", name: "Polaris Bank" },
    { code: "214", name: "FCMB" },
    { code: "032", name: "Wema Bank" },
    { code: "038", name: "Jaiz Bank" },
    { code: "503", name: "Opay" },
    { code: "505", name: "Kuda Microfinance Bank" },
    { code: "502", name: "PalmPay" },
    { code: "512", name: "Moniepoint MFB" },
  ];

  // Name enquiry mutation
  const nameEnquiryMutation = useMutation({
    mutationFn: async (data: { bankCode: string; accountNumber: string }) => {
      const res = await fetch("/api/wallets/withdraw/name-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Name enquiry failed");
      }
      return res.json();
    },
    onSuccess: (data: NameEnquiryResult) => {
      setNameEnquiry(data);
      setStep("verify");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Withdrawal mutation
  const withdrawMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/wallets/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || result.error || "Withdrawal failed");
      return result as WithdrawalResult;
    },
    onSuccess: (data) => {
      setWithdrawalResult(data);
      setStep("result");
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep("result");
    },
  });

  const handleNameEnquiry = useCallback(() => {
    if (bankCode && accountNumber.length === 10) {
      setError("");
      nameEnquiryMutation.mutate({ bankCode, accountNumber });
    }
  }, [bankCode, accountNumber, nameEnquiryMutation]);

  const handleWithdraw = useCallback(() => {
    if (!nameEnquiry || !wallet || !amount) return;
    setError("");
    setStep("processing");
    withdrawMutation.mutate({
      wallet_id: wallet.id,
      amount: Number(amount),
      beneficiary_bank_code: bankCode,
      beneficiary_account_number: accountNumber,
      beneficiary_account_name: nameEnquiry.accountName,
      name_enquiry_session_id: nameEnquiry.sessionId,
      narration: narration || undefined,
    });
  }, [nameEnquiry, wallet, amount, bankCode, accountNumber, narration, withdrawMutation]);

  const reset = () => {
    setStep("bank");
    setBankCode("");
    setBankName("");
    setAccountNumber("");
    setNameEnquiry(null);
    setAmount("");
    setNarration("");
    setWithdrawalResult(null);
    setError("");
  };

  if (meLoading) return <LoadingState message="Loading…" />;
  if (meError || !me) return <ErrorState message="Couldn't load account" />;
  if (!wallet) return <ErrorState message="Wallet not found" />;

  const availableBalance = wallet.available_balance || 0;

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/wallet" className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition">
          <ArrowLeft className="w-4 h-4 text-ink" />
        </Link>
        <h1 className="font-display font-bold text-[20px] text-ink">Withdraw</h1>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-[11px] text-ink-soft">
        {["Bank", "Account", "Verify", "Amount", "Review"].map((label, i) => {
          const stepOrder: Record<Step, number> = { bank: 0, account: 1, verify: 2, amount: 3, review: 4, processing: 4, result: 4 };
          const current = stepOrder[step];
          const active = i <= current;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${active ? "bg-indigo text-white" : "bg-parchment text-ink-soft"}`}>
                {i + 1}
              </div>
              <span className={active ? "text-ink" : "text-ink-soft"}>{label}</span>
              {i < 4 && <div className="w-3 h-px bg-line" />}
            </div>
          );
        })}
      </div>

      {/* Available balance */}
      <div className="bg-paper border border-line rounded-2xl p-4">
        <p className="text-[11px] text-ink-soft mb-1">Available Balance</p>
        <p className="font-mono font-semibold text-[22px] text-ink">{fmtNGN(availableBalance)}</p>
      </div>

      {/* Step 1: Bank selection */}
      {step === "bank" && (
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-ink mb-2 block">Select Destination Bank</label>
            <div className="relative">
              <select
                value={bankCode}
                onChange={(e) => {
                  setBankCode(e.target.value);
                  setBankName(banks.find(b => b.code === e.target.value)?.name || "");
                  if (e.target.value && accountNumber.length === 10) {
                    setError("");
                  }
                }}
                className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-[15px] text-ink focus:outline-none focus:border-indigo"
              >
                <option value="">Choose a bank…</option>
                {banks.map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            disabled={!bankCode}
            onClick={() => setStep("account")}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Account number */}
      {step === "account" && (
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-ink mb-2 block">Destination Bank</label>
            <div className="bg-paper border border-line rounded-xl px-4 py-3 text-[15px] text-ink flex items-center justify-between">
              <span>{bankName || banks.find(b => b.code === bankCode)?.name}</span>
              <button onClick={() => setStep("bank")} className="text-[11px] text-indigo hover:underline">Change</button>
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-ink mb-2 block">Account Number</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setAccountNumber(val);
                setError("");
              }}
              placeholder="10-digit account number"
              className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-[15px] text-ink font-mono focus:outline-none focus:border-indigo"
            />
            {accountNumber.length > 0 && accountNumber.length < 10 && (
              <p className="text-[11px] text-ink-soft mt-1">{10 - accountNumber.length} digits remaining</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("bank")}>Back</Button>
            <Button
              disabled={accountNumber.length !== 10 || nameEnquiryMutation.isPending}
              onClick={handleNameEnquiry}
              className="flex-1"
            >
              {nameEnquiryMutation.isPending ? "Verifying…" : "Verify Account"}
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-clay/10 border border-clay/30 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-clay flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-clay">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Verify account name */}
      {step === "verify" && nameEnquiry && (
        <div className="space-y-4">
          <div className="bg-paper border border-line rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-indigo">
              <div className="w-8 h-8 rounded-full bg-indigo/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-medium">Account Verified</span>
            </div>

            <div className="space-y-2 pt-2">
              <div>
                <p className="text-[11px] text-ink-soft">Account Name</p>
                <p className="text-[15px] font-medium text-ink">{nameEnquiry.accountName}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-soft">Account Number</p>
                <p className="text-[15px] font-mono text-ink">{nameEnquiry.accountNumber}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-soft">Bank</p>
                <p className="text-[15px] text-ink">{nameEnquiry.bankName}</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-ink-soft text-center">
            Please confirm the account name matches your beneficiary before proceeding.
          </p>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => { setStep("account"); setNameEnquiry(null); }}>
              Wrong Account
            </Button>
            <Button onClick={() => setStep("amount")} className="flex-1">
              Confirm & Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Amount */}
      {step === "amount" && (
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-ink mb-2 block">Withdrawal Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-ink-soft font-mono">₦</span>
              <input
                type="tel"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="0.00"
                className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-4 text-[22px] font-mono font-semibold text-ink focus:outline-none focus:border-indigo"
              />
            </div>
            {amount && Number(amount) > availableBalance && (
              <p className="text-[11px] text-clay mt-1">Amount exceeds available balance</p>
            )}
          </div>

          <div>
            <label className="text-[13px] font-medium text-ink mb-2 block">Narration (optional)</label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value.slice(0, 50))}
              placeholder="What's this for?"
              className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-[15px] text-ink focus:outline-none focus:border-indigo"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("verify")}>Back</Button>
            <Button
              disabled={!amount || Number(amount) <= 0 || Number(amount) > availableBalance}
              onClick={() => setStep("review")}
              className="flex-1"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === "review" && nameEnquiry && (
        <div className="space-y-4">
          <div className="bg-paper border border-line rounded-2xl p-4 space-y-3">
            <h3 className="font-display font-semibold text-[16px] text-ink mb-3">Review Withdrawal</h3>

            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">Amount</span>
                <span className="text-[15px] font-mono font-medium text-ink">{fmtNGN(Number(amount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">Fee</span>
                <span className="text-[15px] font-mono text-ink">{fmtNGN(0)}</span>
              </div>
              <div className="border-t border-line pt-2.5 flex justify-between">
                <span className="text-[13px] font-medium text-ink">Total</span>
                <span className="text-[18px] font-mono font-semibold text-ink">{fmtNGN(Number(amount))}</span>
              </div>
            </div>

            <div className="border-t border-line pt-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">To</span>
                <span className="text-[13px] text-ink">{nameEnquiry.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">Account</span>
                <span className="text-[13px] font-mono text-ink">{nameEnquiry.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-ink-soft">Bank</span>
                <span className="text-[13px] text-ink">{nameEnquiry.bankName}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-ink-soft text-center">
            Funds will be reserved and the transfer will be submitted to Safe Haven. You'll be notified when it completes.
          </p>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("amount")}>Back</Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className="flex-1"
            >
              Withdraw {fmtNGN(Number(amount))}
            </Button>
          </div>
        </div>
      )}

      {/* Step 6: Processing */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-indigo/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="font-display font-semibold text-[18px] text-ink">Processing Withdrawal</h3>
            <p className="text-[13px] text-ink-soft mt-1">
              Reserving funds and submitting transfer to Safe Haven…
            </p>
          </div>
        </div>
      )}

      {/* Step 7: Result */}
      {step === "result" && (
        <div className="space-y-4">
          {withdrawalResult && withdrawalResult.status === "completed" && (
            <>
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-16 h-16 rounded-full bg-indigo/10 flex items-center justify-center">
                  <Check className="w-8 h-8 text-indigo" />
                </div>
                <h3 className="font-display font-semibold text-[18px] text-ink">Withdrawal Successful</h3>
                <p className="text-[22px] font-mono font-semibold text-ink">{fmtNGN(Number(amount))}</p>
                <p className="text-[13px] text-ink-soft">Reference: {withdrawalResult.payment_reference}</p>
              </div>

              <div className="bg-paper border border-line rounded-2xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[13px] text-ink-soft">Status</span>
                  <span className="text-[13px] text-indigo font-medium">Completed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-ink-soft">Beneficiary</span>
                  <span className="text-[13px] text-ink">{nameEnquiry?.accountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-ink-soft">Account</span>
                  <span className="text-[13px] font-mono text-ink">{accountNumber}</span>
                </div>
              </div>
            </>
          )}

          {withdrawalResult && withdrawalResult.status === "pending" && (
            <>
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-16 h-16 rounded-full bg-ochre/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-ochre animate-spin" />
                </div>
                <h3 className="font-display font-semibold text-[18px] text-ink">Transfer Submitted</h3>
                <p className="text-[13px] text-ink-soft text-center max-w-xs">
                  Your withdrawal is being processed. You'll be notified when it's completed.
                </p>
                <p className="text-[13px] font-mono text-ink-soft">Ref: {withdrawalResult.payment_reference}</p>
              </div>
            </>
          )}

          {withdrawalResult && withdrawalResult.status === "failed" && (
            <>
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-16 h-16 rounded-full bg-clay/10 flex items-center justify-center">
                  <X className="w-8 h-8 text-clay" />
                </div>
                <h3 className="font-display font-semibold text-[18px] text-ink">Withdrawal Failed</h3>
                <p className="text-[13px] text-clay text-center max-w-xs">{withdrawalResult.message || error || "The transfer could not be completed."}</p>
              </div>
            </>
          )}

          {error && !withdrawalResult && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-16 h-16 rounded-full bg-clay/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-clay" />
              </div>
              <h3 className="font-display font-semibold text-[18px] text-ink">Error</h3>
              <p className="text-[13px] text-clay text-center">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/wallet" className="flex-1">
              <Button variant="ghost" className="w-full">Back to Wallet</Button>
            </Link>
            <Button onClick={reset} className="flex-1">New Withdrawal</Button>
          </div>
        </div>
      )}
    </div>
  );
}
