"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

const quickAmounts = [5000, 10000, 20000, 50000];

const accounts = [
  { id: "flex", name: "Flex Savings", balance: 15000 },
  { id: "1", name: "Planting Season Inputs", balance: 90000 },
  { id: "2", name: "Tractor Fund", balance: 50000 },
];

export default function DepositPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("flex");
  const [step, setStep] = useState<"amount" | "processing" | "success">("amount");

  const handleDeposit = () => {
    setStep("processing");
    // This will call our Stripe/Paystack backend function
    setTimeout(() => {
      setStep("success");
    }, 2000);
  };

  if (step === "success") {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-lime/20 flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8 text-brand-green" strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-semibold text-stone-900">Deposit Successful</h1>
        <p className="text-sm text-stone-500 mt-2">
          ₦{Number(amount).toLocaleString()} has been added to your{" "}
          {accounts.find((a) => a.id === selectedAccount)?.name}
        </p>
        <div className="bg-brand-gray rounded-xl p-4 mt-6 text-left">
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-stone-500">Amount</span>
            <span className="font-medium tabular-nums">₦{Number(amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-stone-500">To</span>
            <span className="font-medium">{accounts.find((a) => a.id === selectedAccount)?.name}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-stone-500">Fee</span>
            <span className="font-medium">₦0</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-t border-brand-border mt-1.5 pt-2.5">
            <span className="text-stone-500">Reference</span>
            <span className="font-mono text-xs text-stone-600">AGC_{Date.now().toString().slice(-8)}</span>
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
        <p className="text-sm font-medium text-stone-700">Processing your deposit...</p>
        <p className="text-xs text-stone-400 mt-1">Please don't close this page</p>
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
        <h1 className="text-lg font-semibold text-stone-900">Deposit Money</h1>
      </div>

      {/* Account Selector */}
      <div className="mb-5">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Save To</label>
        <div className="mt-2 space-y-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setSelectedAccount(account.id)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-colors ${
                selectedAccount === account.id
                  ? "border-brand-green bg-brand-green/5"
                  : "border-brand-border hover:border-stone-300"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{account.name}</p>
                <p className="text-xs text-stone-400 mt-0.5">Balance: ₦{account.balance.toLocaleString()}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedAccount === account.id ? "border-brand-green" : "border-stone-300"
              }`}>
                {selectedAccount === account.id && <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-5">
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

      {/* Quick Amounts */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => setAmount(amt.toString())}
            className="py-2 rounded-lg bg-brand-gray text-sm font-medium text-stone-700 hover:bg-stone-200 transition-colors tabular-nums"
          >
            ₦{amt >= 1000 ? `${amt / 1000}k` : amt}
          </button>
        ))}
      </div>

      {/* Info */}
      <div className="bg-brand-cream rounded-xl p-3.5 mb-6">
        <p className="text-xs text-stone-500">
          💡 Deposits are processed via Stripe. Your money is held securely and insured. No fees on deposits.
        </p>
      </div>

      {/* Deposit Button */}
      <button
        onClick={handleDeposit}
        disabled={!amount || Number(amount) < 100}
        className="w-full bg-brand-gold text-stone-900 rounded-xl py-3.5 font-semibold text-sm hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {amount ? `Deposit ₦${Number(amount).toLocaleString()}` : "Enter an amount"}
      </button>
      <p className="text-xs text-stone-400 text-center mt-3">Minimum deposit: ₦100</p>
    </div>
  );
}
