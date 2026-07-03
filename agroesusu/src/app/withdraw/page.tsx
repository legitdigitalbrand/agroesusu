"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function WithdrawPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "processing" | "success">("amount");

  const flexBalance = 15000;
  const feeRate = 0.01; // 1% fee
  const fee = amount ? Math.round(Number(amount) * feeRate) : 0;
  const youReceive = amount ? Number(amount) - fee : 0;

  const handleWithdraw = () => {
    setStep("processing");
    setTimeout(() => setStep("success"), 2000);
  };

  if (step === "success") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-lime/20 flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8 text-brand-green" strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-semibold text-stone-900">Withdrawal Processing</h1>
        <p className="text-sm text-stone-500 mt-2">
          ₦{youReceive.toLocaleString()} will be sent to your bank account within a few minutes.
        </p>
        <div className="bg-brand-gray rounded-xl p-4 mt-6 text-left">
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-stone-500">Withdrawal</span>
            <span className="font-medium tabular-nums">₦{Number(amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-stone-500">Fee (1%)</span>
            <span className="font-medium tabular-nums">−₦{fee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-t border-brand-border mt-1.5 pt-2.5">
            <span className="text-stone-700 font-medium">You receive</span>
            <span className="font-semibold tabular-nums">₦{youReceive.toLocaleString()}</span>
          </div>
        </div>
        <Link
          href="/"
          className="block w-full bg-brand-green text-white rounded-xl py-3.5 font-semibold text-sm mt-6 hover:bg-brand-green-dark transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-12 h-12 border-3 border-brand-lime border-t-transparent rounded-full animate-spin mx-auto mb-5" />
        <p className="text-sm font-medium text-stone-700">Sending to your bank...</p>
        <p className="text-xs text-stone-400 mt-1">Funds typically arrive within minutes</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-brand-gray flex items-center justify-center hover:bg-stone-200">
          <ArrowLeft className="w-4.5 h-4.5 text-stone-600" />
        </button>
        <h1 className="text-lg font-semibold text-stone-900">Withdraw Money</h1>
      </div>

      {/* Available Balance */}
      <div className="bg-brand-gray rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500">Available in Flex Savings</p>
            <p className="text-xl font-semibold text-stone-900 mt-0.5 tabular-nums">₦{flexBalance.toLocaleString()}</p>
          </div>
          <button
            onClick={() => setAmount(flexBalance.toString())}
            className="text-xs font-medium text-brand-green bg-brand-green/5 px-3 py-1.5 rounded-lg hover:bg-brand-green/10"
          >
            Max
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Amount</label>
        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-stone-400">₦</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full pl-12 pr-4 py-4 text-2xl font-semibold tabular-nums rounded-xl border border-brand-border focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
            autoFocus
          />
        </div>
      </div>

      {/* Fee Breakdown */}
      {amount && Number(amount) > 0 && (
        <div className="bg-brand-cream rounded-xl p-4 mb-5">
          <div className="flex justify-between text-sm py-1">
            <span className="text-stone-500">Withdrawal amount</span>
            <span className="font-medium tabular-nums">₦{Number(amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-stone-500">Processing fee (1%)</span>
            <span className="font-medium tabular-nums text-red-500">−₦{fee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-t border-brand-border mt-1.5 pt-2.5">
            <span className="text-stone-700 font-medium">You receive</span>
            <span className="font-semibold tabular-nums">₦{youReceive.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Locked Notice */}
      <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3.5 mb-6">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Only Flex Savings can be withdrawn anytime. Goal withdrawals depend on your lock type.
        </p>
      </div>

      {/* Withdraw Button */}
      <button
        onClick={handleWithdraw}
        disabled={!amount || Number(amount) < 100 || Number(amount) > flexBalance}
        className="w-full bg-brand-green text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-brand-green-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {amount && Number(amount) > flexBalance
          ? "Insufficient balance"
          : amount
          ? `Withdraw ₦${Number(amount).toLocaleString()}`
          : "Enter an amount"}
      </button>
    </div>
  );
}
