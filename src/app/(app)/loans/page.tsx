"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LoadingState, Button,
} from "@/components/yield";
import {
  Landmark, AlertCircle, Check, X, TrendingUp, Shield,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Loans Page — Eligibility with credit score breakdown + loan products
// ════════════════════════════════════════════════════════════

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

interface EligibilityFactor {
  factor: string;
  value: number | string;
  threshold: number | string;
  passed: boolean;
  weight: number;
  contribution: string;
}

interface EligibilityResult {
  decision: 'approved' | 'denied' | 'amount_adjusted';
  approved_amount: number;
  factors: EligibilityFactor[];
  credit_score: number;
  savings_balance: number;
  max_eligible_amount: number;
  cooperative_status: string;
  rationale: string;
}

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

// Credit score rating
function scoreRating(score: number): { label: string; color: string } {
  if (score >= 700) return { label: 'Excellent', color: 'text-loam' };
  if (score >= 600) return { label: 'Good', color: 'text-loam' };
  if (score >= 500) return { label: 'Fair', color: 'text-ochre-dim' };
  return { label: 'Needs improvement', color: 'text-clay' };
}

// Human-readable factor names
const factorLabels: Record<string, string> = {
  savings_balance: 'Savings Balance',
  kyc_level: 'Identity Verification',
  credit_score: 'Credit Score',
  cooperative_membership: 'Cooperative Membership',
  savings_tenure: 'Savings History',
  wallet_activity: 'Wallet Activity',
  repayment_history: 'Repayment History',
  account_age: 'Account Age',
  consistency: 'Consistency',
};

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
          My Loans {loans.length > 0 && `(${loans.length})`}
        </TabButton>
        <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
          Check Eligibility
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
            <LoadingState message="Loading loan products…" />
          ) : products.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center bg-paper">
              <p className="text-sm text-ink-soft">No loan products available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <EligibilityCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Eligibility Card with credit score breakdown ───
function EligibilityCard({ product }: { product: LoanProduct }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EligibilityResult | null>(null);
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
      const data: EligibilityResult = await res.json();
      setResult(data);
      if (data.max_eligible_amount > 0) {
        setAmount(Math.min(data.max_eligible_amount, product.max_amount || data.max_eligible_amount));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check eligibility");
    } finally {
      setLoading(false);
    }
  };

  const isApproved = result?.decision === 'approved' || result?.decision === 'amount_adjusted';
  const maxBorrow = result?.max_eligible_amount || result?.approved_amount || product.max_amount || 375000;
  const rating = result ? scoreRating(result.credit_score) : null;

  const monthlyPayment = product.interest_type === "flat"
    ? Math.round((amount + (amount * product.interest_rate / 100 * product.term_months / 12)) / product.term_months)
    : Math.round(amount / product.term_months * (1 + product.interest_rate / 100 / 12));

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      {/* Product header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-loam-light flex items-center justify-center flex-shrink-0">
          <Landmark className="h-5 w-5 text-indigo" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <p className="font-medium text-[15px] text-ink">{product.product_name}</p>
          <p className="text-[12px] text-ink-soft">
            {product.interest_rate}% {product.interest_type === "flat" ? "flat" : "reducing"} · {product.term_months} months
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-soft">Up to</p>
          <p className="font-mono text-[14px] text-ink font-medium">{fmtNGN(product.max_amount)}</p>
        </div>
      </div>

      {/* Initial state — check button */}
      {!result && !loading && !error && (
        <button
          onClick={checkEligibility}
          className="w-full py-2.5 bg-indigo text-white rounded-xl font-medium text-[14px] hover:bg-indigo-deep transition flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Check eligibility
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] text-ink-soft">Checking eligibility…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="space-y-3">
          <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] text-clay font-medium">Could not check eligibility</p>
              <p className="text-[13px] text-ink-soft mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={checkEligibility}
            className="w-full py-2.5 border border-line rounded-xl font-medium text-[14px] text-ink hover:bg-parchment transition"
          >
            Try again
          </button>
        </div>
      )}

      {/* Result — Approved or Amount Adjusted */}
      {result && isApproved && !loading && (
        <div className="space-y-4 mt-2">
          {/* Credit score badge */}
          {rating && (
            <div className="flex items-center justify-between bg-parchment rounded-xl p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-ink-soft" />
                <span className="text-[13px] text-ink-soft">Credit score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[18px] font-semibold text-ink">{result.credit_score}</span>
                <span className={`text-[12px] font-medium ${rating.color}`}>{rating.label}</span>
              </div>
            </div>
          )}

          {/* Approval card */}
          <div className="bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl p-4 text-white">
            <p className="text-[12px] text-white/70 mb-1">You can borrow up to</p>
            <p className="font-mono text-[26px] font-medium mb-3">{fmtNGN(maxBorrow)}</p>
            <div className="space-y-0">
              <FactorRow label="Interest rate" value={`${product.interest_rate}% ${product.interest_type === "flat" ? "flat" : "reducing"}`} />
              <FactorRow label="Term" value={`${product.term_months} months`} />
              {result.savings_balance > 0 && (
                <FactorRow label="Savings balance" value={fmtNGN(result.savings_balance)} />
              )}
              {result.decision === 'amount_adjusted' && (
                <FactorRow label="Approved amount" value={fmtNGN(result.approved_amount)} />
              )}
            </div>
          </div>

          {/* Amount selector */}
          <div className="border border-line rounded-2xl p-4 bg-paper">
            <p className="text-xs text-ink-soft mb-1.5">How much do you need?</p>
            <p className="font-mono text-2xl text-center text-ink my-2">{fmtNGN(amount)}</p>
            <input
              type="range"
              min={product.min_amount || 20000}
              max={maxBorrow}
              step={5000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-indigo"
            />
            <p className="text-[11px] text-ink-soft text-center mt-1.5">
              Monthly repayment: <span className="font-mono text-ink">{fmtNGN(monthlyPayment)}</span>
            </p>
          </div>

          {/* Apply button */}
          <Link
            href={`/loans/apply?product=${product.id}&amount=${amount}`}
            className="block w-full bg-ochre text-indigo-deep text-center font-semibold text-[15px] py-3 rounded-[14px] hover:opacity-90 transition"
          >
            Apply for {fmtNGN(amount)}
          </Link>
        </div>
      )}

      {/* Result — Denied with actionable feedback */}
      {result && !isApproved && !loading && (
        <div className="space-y-4 mt-2">
          {/* Credit score badge (even when denied) */}
          {rating && result.credit_score > 0 && (
            <div className="flex items-center justify-between bg-parchment rounded-xl p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-ink-soft" />
                <span className="text-[13px] text-ink-soft">Credit score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[18px] font-semibold text-ink">{result.credit_score}</span>
                <span className={`text-[12px] font-medium ${rating.color}`}>{rating.label}</span>
              </div>
            </div>
          )}

          {/* Denied message */}
          <div className="bg-clay-light rounded-2xl p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-clay mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-[14px] text-clay">Not eligible yet</p>
                <p className="text-[13px] text-ink-soft mt-1">{result.rationale || "You don't meet the requirements for this loan product yet."}</p>
              </div>
            </div>
          </div>

          {/* Factor breakdown — what passed and what didn't */}
          {result.factors && result.factors.length > 0 && (
            <div className="border border-line rounded-2xl p-4 bg-paper">
              <p className="text-[13px] font-medium text-ink mb-3">Requirements breakdown</p>
              <div className="space-y-2">
                {result.factors.map((f, i) => (
                  <FactorCheck key={i} factor={f} />
                ))}
              </div>
            </div>
          )}

          {/* Actionable next steps */}
          <div className="bg-parchment rounded-xl p-3.5">
            <p className="text-[13px] text-ink-soft mb-2">Here's what you can do:</p>
            <NextSteps factors={result.factors} savingsBalance={result.savings_balance} />
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

// ─── Factor check row ───
function FactorCheck({ factor }: { factor: EligibilityFactor }) {
  const label = factorLabels[factor.factor] || factor.factor;
  const valueStr = typeof factor.value === 'number'
    ? factor.factor === 'savings_balance'
      ? fmtNGN(factor.value)
      : String(factor.value)
    : String(factor.value);
  const thresholdStr = typeof factor.threshold === 'number'
    ? factor.factor === 'savings_balance'
      ? fmtNGN(factor.threshold)
      : String(factor.threshold)
    : String(factor.threshold);

  return (
    <div className="flex items-center justify-between text-[13px]">
      <div className="flex items-center gap-2">
        {factor.passed ? (
          <Check className="w-3.5 h-3.5 text-loam flex-shrink-0" />
        ) : (
          <X className="w-3.5 h-3.5 text-clay flex-shrink-0" />
        )}
        <span className={factor.passed ? 'text-ink' : 'text-ink-soft'}>{label}</span>
      </div>
      <div className="text-right">
        <span className={`font-mono ${factor.passed ? 'text-loam' : 'text-clay'}`}>{valueStr}</span>
        {!factor.passed && (
          <span className="text-ink-soft ml-1">/ {thresholdStr}</span>
        )}
      </div>
    </div>
  );
}

// ─── Next steps — actionable feedback ───
function NextSteps({ factors, savingsBalance }: { factors: EligibilityFactor[]; savingsBalance: number }) {
  const failed = factors.filter(f => !f.passed);
  const steps: string[] = [];

  for (const f of failed) {
    switch (f.factor) {
      case 'savings_balance':
        const needed = typeof f.threshold === 'number' ? f.threshold - savingsBalance : 0;
        if (needed > 0) {
          steps.push(`Deposit at least ${fmtNGN(needed)} more into your savings account.`);
        } else {
          steps.push('Build your savings balance to qualify.');
        }
        break;
      case 'kyc_level':
        steps.push('Complete identity verification (BVN/NIN) to unlock eligibility.');
        break;
      case 'credit_score':
        steps.push(`Improve your credit score to ${f.threshold} by saving consistently.`);
        break;
      case 'savings_tenure':
        steps.push('Maintain savings for longer to build your savings history.');
        break;
      case 'cooperative_membership':
        steps.push('Cooperative membership is required for this product.');
        break;
      case 'repayment_history':
        steps.push('Maintain good repayment history on existing loans.');
        break;
      case 'wallet_activity':
        steps.push('Use your wallet more actively — fund and transact regularly.');
        break;
      default:
        steps.push(`Improve your ${factorLabels[f.factor] || f.factor} to meet the requirement.`);
    }
  }

  if (steps.length === 0) {
    steps.push('Keep saving consistently to improve your eligibility.');
  }

  return (
    <ul className="space-y-1.5">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] text-ink">
          <span className="text-ochre-dim mt-0.5">→</span>
          <span>{step}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Factor row inside the approved card ───
function FactorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px] py-1.5 border-t border-white/15 first:border-t-0">
      <span className="text-white/60">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  );
}

// ─── Loan card ───
function LoanCard({ loan }: { loan: Loan }) {
  const statusColor: Record<string, string> = {
    active: "bg-loam-light text-loam",
    disbursed: "bg-loam-light text-loam",
    overdue: "bg-clay-light text-clay",
    pending: "bg-parchment text-ink-soft",
  };

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-ink">{loan.product?.product_name || "Loan"}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            {loan.status === "pending" ? "Awaiting review" : `Next due: ${loan.next_due_date ? new Date(loan.next_due_date).toLocaleDateString("en-NG", { day: 'numeric', month: 'short' }) : "—"}`}
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

// ─── Tab button ───
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
