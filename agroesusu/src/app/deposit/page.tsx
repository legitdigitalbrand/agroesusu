"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDeposit = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/deposit/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          account_id: selectedAccount,
          account_name: accounts.find((a) => a.id === selectedAccount)?.name,
          email: "chinedu@example.com", // Will be replaced with real user email
          user_id: "current_user_id", // Will be replaced with real user ID
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize payment");
      }

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200"
        >
          <ArrowLeft className="w-4 h-4 text-stone-600" />
        </button>
        <h1 className="text-lg font-semibold text-stone-900">Deposit Money</h1>
      </div>

      {/* Account Selector */}
      <div className="mb-5">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
          Save To
        </label>
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
                <p className="text-sm font-medium text-stone-900">
                  {account.name}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Balance: ₦{account.balance.toLocaleString()}
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedAccount === account.id
                    ? "border-brand-green"
                    : "border-stone-300"
                }`}
              >
                {selectedAccount === account.id && (
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-5">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
          Amount
        </label>
        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-stone-400">
            ₦
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full pl-12 pr-4 py-4 text-2xl font-semibold tabular-nums rounded-xl border border-brand-border focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
            autoFocus
            disabled={loading}
          />
        </div>
      </div>

      {/* Quick Amounts */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => setAmount(amt.toString())}
            disabled={loading}
            className="py-2 rounded-lg bg-stone-100 text-sm font-medium text-stone-700 hover:bg-stone-200 transition-colors tabular-nums disabled:opacity-50"
          >
            ₦{amt >= 1000 ? `${amt / 1000}k` : amt}
          </button>
        ))}
      </div>

      {/* Info */}
      <div className="bg-amber-50 rounded-xl p-3.5 mb-6">
        <p className="text-xs text-amber-700">
          💡 Deposits are processed via Paystack. Your money is held securely. No
          fees on deposits — we cover the Paystack charges.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {/* Deposit Button */}
      <button
        onClick={handleDeposit}
        disabled={!amount || Number(amount) < 100 || loading}
        className="w-full bg-brand-gold text-stone-900 rounded-xl py-3.5 font-semibold text-sm hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Initializing...
          </>
        ) : amount ? (
          `Deposit ₦${Number(amount).toLocaleString()}`
        ) : (
          "Enter an amount"
        )}
      </button>
      <p className="text-xs text-stone-400 text-center mt-3">
        Minimum deposit: ₦100
      </p>
    </div>
  );
}
