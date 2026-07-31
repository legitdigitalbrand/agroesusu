"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LoadingState, Button,
} from "@/components/yield";
import {
  Landmark, AlertCircle,
} from "lucide-react";

interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  interest_rate: number;
  interest_type: string;
  min_amount: number;
  max_amount: number;
  term_months: number;
  min_kyc_level: number;
}

interface Loan {
  id: string;
  status: string;
  principal_amount: number;
  outstanding_balance: number;
  next_due_date: string;
  product: { product_name: string; interest_rate: number };
}

interface EligibilityResult {
  eligible: boolean;
  max_amount: number;
  reason?: string;
  reason_code?: string;
  savings_balance?: number;
  multiplier?: number;
}

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

export default function LoansPage() {
  const [activeTab, setActiveTab] = useState<"loans" | "products">("products");

  const { data: loansData, isLoading: loansLoading } = useQuery<{ loans: Loan[] }>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans");
      if (!res.ok) return { loans: [] };
      return res.json();
    },
  });

  const { data: productsData, isLoading: prodsLoading } = useQuery<{ products: LoanProduct[] }>({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/loans/products");
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const loans = loansData?.loans || [];
  const products = productsData?.products || [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[22px] font-medium text-ink">Loans</h1>

      <div className="flex gap-1 bg-parchment rounded-xl p-1">
        <TabButton active={activeTab === "loans"} onClick={() => setActiveTab("loans")}>
          My Loans
        </TabButton>
        <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
          Eligibility
        </TabButton>
      </div>

      {activeTab === "loans" && (
        <>
          {loansLoading ? (
            <LoadingState message="Loading your loans…" />
          ) : loans.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center bg-paper">
              <div className="w-12 h-12 rounded-full bg-parchment flex items-center justify-center mx-auto mb-3">
                <Landmark className="w-6 h-6 text-ink-soft" strokeWidth={1.5} />
              </div>
              <p className="font-medium text-[14px] text-ink mb-1">No active loans</p>
              <p className="text-[12px] text-ink-soft mb-4">Check your eligibility to see what you can borrow</p>
              <Button size="sm" onClick={() => setActiveTab("products")}>
                Check your eligibility
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "products" && (
        <>
          {prodsLoading ? (
            <LoadingState message="Loading products…" />
          ) : products.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center bg-paper">
              <p className="text-sm text-ink-soft">No loan products available</p>
            </div>
          ) : (
            <div className="space-y-5">
              {products.map((product) => (
                <ProductEligibility key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductEligibility({ product }: { product: LoanProduct }) {
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(product.min_amount || 20000);

  const checkEligibility = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/loans/eligibility?product_id=${product.id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Could not check eligibility");
      }
      const data = await res.json();
      setResult(data);
      if (data.max_amount && data.max_amount > 0) {
        setAmount(Math.min(data.max_amount, product.max_amount || data.max_amount));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check eligibility");
    } finally {
      setLoading(false);
    }
  };

  const maxBorrow = result?.max_amount || product.max_amount || 375000;
  const monthlyPayment = product.interest_type === "flat"
    ? Math.round((amount + (amount * product.interest_rate / 100 * product.term_months / 12)) / product.term_months)
    : Math.round(amount / product.term_months * (1 + product.interest_rate / 100 / 12));

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-loam-light flex items-center justify-center flex-shrink-0">
          <Landmark className="h-5 w-5 text-indigo" strokeWidth={1.8} />
        </div>
        <div>
          <p className="font-medium text-[15px] text-ink">{product.product_name}</p>
          <p className="text-[12px] text-ink-soft">
            {product.interest_rate}% {product.interest_type === "flat" ? "flat" : "reducing"} · {product.term_months} months
          </p>
        </div>
      </div>

      {/* Eligibility button */}
      {!result && !loading && !error && (
        <button
          onClick={checkEligibility}
          className="w-full py-2.5 bg-indigo text-white rounded-xl font-medium text-[14px] hover:bg-indigo-deep transition"
        >
          Check eligibility
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-2.5">
          <div className="w-4 h-4 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] text-ink-soft">Checking eligibility…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="space-y-3">
          <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-clay">{error}</p>
          </div>
          <button
            onClick={checkEligibility}
            className="w-full py-2.5 border border-line rounded-xl font-medium text-[14px] text-ink hover:bg-parchment transition"
          >
            Try again
          </button>
        </div>
      )}

      {/* Result — eligible */}
      {result && result.eligible && !loading && (
        <div className="space-y-4 mt-3">
          <div className="bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl p-4 text-white">
            <p className="text-[12px] text-white/70 mb-1">You can borrow up to</p>
            <p className="font-mono text-[26px] font-medium mb-3">{fmtNGN(result.max_amount || maxBorrow)}</p>
            <div className="space-y-0">
              <FactorRow label="Interest rate" value={`${product.interest_rate}% ${product.interest_type === "flat" ? "flat" : "reducing"}`} />
              <FactorRow label="Term" value={`${product.term_months} months`} />
              {result.savings_balance !== undefined && (
                <FactorRow label="Savings balance" value={fmtNGN(result.savings_balance)} />
              )}
              {result.multiplier && (
                <FactorRow label="Multiplier" value={`${result.multiplier}×`} />
              )}
            </div>
          </div>

          <div className="border border-line rounded-2xl p-4 bg-paper">
            <p className="text-xs text-ink-soft mb-1.5">How much do you need?</p>
            <p className="font-mono text-2xl text-center text-ink my-2">{fmtNGN(amount)}</p>
            <input
              type="range"
              min={product.min_amount || 20000}
              max={result.max_amount || maxBorrow}
              step={5000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-indigo"
            />
            <p className="text-[11px] text-ink-soft text-center mt-1.5">
              Monthly repayment: <span className="font-mono text-ink">{fmtNGN(monthlyPayment)}</span>
            </p>
          </div>

          <button
            onClick={() => alert("Loan application flow coming soon. Your eligibility has been confirmed.")}
            className="block w-full bg-ochre text-indigo-deep text-center font-semibold text-[15px] py-3 rounded-[14px] hover:opacity-90 transition"
          >
            Apply for {fmtNGN(amount)}
          </button>
        </div>
      )}

      {/* Result — not eligible */}
      {result && !result.eligible && !loading && (
        <div className="space-y-3 mt-3">
          <div className="bg-clay-light rounded-2xl p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-clay mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-[14px] text-clay">Not eligible yet</p>
                <p className="text-[13px] text-ink-soft mt-1">{result.reason || "You don't meet the requirements for this loan product."}</p>
              </div>
            </div>
          </div>
          <div className="bg-parchment rounded-xl p-3">
            <p className="text-[13px] text-ink-soft">
              {result.reason_code === "insufficient_savings" && "Build more savings to unlock loan eligibility. Open a savings account and start saving."}
              {result.reason_code === "insufficient_kyc" && "Complete identity verification to unlock loan eligibility."}
              {result.reason_code === "no_wallet" && "You need an active wallet to apply for loans. Fund your wallet first."}
              {!result.reason_code && "Keep saving consistently to improve your eligibility."}
            </p>
          </div>
          <button
            onClick={checkEligibility}
            className="w-full py-2.5 border border-line rounded-xl font-medium text-[14px] text-ink hover:bg-parchment transition"
          >
            Check again
          </button>
        </div>
      )}
    </div>
  );
}

function FactorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px] py-1.5 border-t border-white/15 first:border-t-0">
      <span className="text-white/60">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const statusColor: Record<string, string> = {
    active: "bg-loam-light text-loam",
    disbursed: "bg-loam-light text-loam",
    overdue: "bg-clay-light text-clay",
    pending: "bg-ochre-light text-ink/60",
  };

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-ink">{loan.product?.product_name || "Loan"}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            {loan.status === "pending" ? "Awaiting review" : `Next due: ${loan.next_due_date ? new Date(loan.next_due_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "—"}`}
          </p>
        </div>
        <span className={`text-[12px] px-2 py-0.5 rounded-full ${statusColor[loan.status] || "bg-parchment text-ink-soft"}`}>
          {loan.status}
        </span>
      </div>
      <p className="font-mono text-lg text-ink">{fmtNGN(loan.outstanding_balance)}</p>
      <p className="text-xs text-ink-soft">outstanding</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs font-medium px-3.5 py-2 rounded-lg transition ${
        active ? "bg-indigo text-white" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
