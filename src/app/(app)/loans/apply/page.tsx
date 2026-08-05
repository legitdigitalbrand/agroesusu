"use client";

import { useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Button,
  Skeleton,
} from "@/components/yield";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Landmark,
  Loader2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_type: string;
  description: string | null;
  interest_method: string;
  interest_rate: number;
  min_term_months: number;
  max_term_months: number;
  default_term_months: number;
  min_amount: number;
  max_amount: number | null;
  origination_fee_rate: number;
  processing_fee: number;
}

interface EligibilityResult {
  decision: "approved" | "denied" | "amount_adjusted";
  approved_amount: number;
  max_eligible_amount: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

const TERM_OPTIONS = [
  { months: 1, label: "30 Days" },
  { months: 2, label: "60 Days" },
  { months: 3, label: "90 Days" },
  { months: 6, label: "180 Days" },
  { months: 12, label: "365 Days" },
];

const PURPOSES = [
  "Business",
  "Agriculture",
  "Education",
  "Medical",
  "Emergency",
  "Home",
  "Transport",
  "Other",
];

// ═══════════════════════════════════════════════════════════════
// Step indicator
// ═══════════════════════════════════════════════════════════════
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? "bg-indigo flex-1" : i === current ? "bg-ochre flex-1" : "bg-line w-8"
          }`}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Apply Content
// ═══════════════════════════════════════════════════════════════
function LoanApplyContent() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const productId = params.get("product");
  const initialAmount = params.get("amount");

  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState(initialAmount ? parseFloat(initialAmount) : 0);
  const [termMonths, setTermMonths] = useState(3);
  const [purpose, setPurpose] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ── Fetch product ──
  const { data: productsData, isLoading } = useQuery<{ products: LoanProduct[] }>({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/loans/products");
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const product = productsData?.products?.find((p) => p.id === productId);

  // ── Fetch eligibility ──
  const { data: eligibility } = useQuery<EligibilityResult>({
    queryKey: ["loan-eligibility", productId],
    queryFn: async () => {
      const res = await fetch(`/api/loans/eligibility?product_id=${productId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!productId,
  });

  // ── Calculations (live, client-side) ──
  const calculations = useMemo(() => {
    if (!product || amount <= 0) return null;
    const principal = amount;
    const interestRate = product.interest_rate / 100;
    const totalInterest =
      product.interest_method === "flat"
        ? Math.round(principal * interestRate * termMonths)
        : Math.round(principal * interestRate * termMonths * (1 + interestRate * termMonths / 2));
    const processingFee = Math.round(principal * (product.origination_fee_rate || 0) / 100) + (product.processing_fee || 0);
    const totalRepayment = principal + totalInterest + processingFee;
    const monthlyRepayment = Math.round(totalRepayment / termMonths);
    const disbursement = principal - processingFee;

    return { principal, interestRate, totalInterest, processingFee, totalRepayment, monthlyRepayment, disbursement };
  }, [product, amount, termMonths]);

  // ── Submit mutation ──
  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          requested_amount: amount,
          term_months: termMonths,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply for loan");
      return data;
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  // ── No product selected ──
  if (!productId) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-parchment flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-ink-soft" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-semibold text-ink mb-1">No loan product selected</p>
        <p className="text-sm text-ink-soft mb-6">Browse our available loan products to get started.</p>
        <Link href="/loans">
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo text-white font-semibold text-sm hover:bg-indigo-deep transition">
            <ArrowLeft className="w-4 h-4" /> Back to Loans
          </span>
        </Link>
      </div>
    );
  }

  // ── Post-submission state ──
  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-loam-light flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-loam" strokeWidth={2} />
          </div>
          <h1 className="font-display font-bold text-2xl text-ink">Application Submitted</h1>
          <p className="text-sm text-ink-soft max-w-sm mx-auto">
            We&apos;re reviewing your application. Estimated review time: 2–10 minutes.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Loader2 className="w-4 h-4 text-indigo animate-spin" />
            <span className="text-xs text-ink-soft">We&apos;ll notify you once approved.</span>
          </div>
        </div>
        <div className="mt-8 space-y-3">
          <Link href="/loans">
            <span className="block w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-sm text-center hover:opacity-90 transition">
              View My Applications
            </span>
          </Link>
          <Link href="/dashboard">
            <span className="block w-full py-3 text-ink-soft text-sm text-center hover:text-ink transition">
              Go to Dashboard
            </span>
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (isLoading || !product) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Skeleton variant="text" className="w-24 h-6" />
        <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
        <Skeleton variant="rectangular" className="h-64 rounded-2xl" />
      </div>
    );
  }

  // ── Derive constraints ──
  const maxBorrow = eligibility?.max_eligible_amount || eligibility?.approved_amount || product.max_amount || 500000;
  const minBorrow = product.min_amount || 10000;
  const effectiveMax = Math.min(maxBorrow, product.max_amount || maxBorrow);
  const validTerms = TERM_OPTIONS.filter((t) => t.months >= product.min_term_months && t.months <= product.max_term_months);

  const canProceed = step === 1 ? amount >= minBorrow && amount <= effectiveMax
    : step === 2 ? validTerms.some((t) => t.months === termMonths)
    : step === 3 ? true
    : step === 4 ? !!purpose
    : step === 5 ? agreed
    : false;

  const totalSteps = 5;

  return (
    <div className="max-w-lg mx-auto">
      {/* Back link */}
      <Link href="/loans" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Loans
      </Link>

      {/* Product header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo to-indigo-deep flex items-center justify-center shadow-sm">
          <Landmark className="w-6 h-6 text-white" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-ink">{product.product_name}</h1>
          <p className="text-sm text-ink-soft">{product.interest_rate}% monthly • {product.interest_method === "flat" ? "Flat" : "Reducing balance"}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-6">
        <StepIndicator current={step} total={totalSteps} />
        <p className="text-xs text-ink-soft mt-2">Step {step} of {totalSteps}</p>
      </div>

      {/* ═══ STEP 1: AMOUNT ═══ */}
      {step === 1 && (
        <Card variant="elevated" padding="lg" className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-lg text-ink mb-1">How much do you need?</h2>
            <p className="text-sm text-ink-soft">Drag the slider to choose your loan amount.</p>
          </div>

          {/* Amount display */}
          <div className="text-center py-4">
            <p className="text-4xl font-bold font-mono text-ink">{fmtNGN(amount)}</p>
            <p className="text-xs text-ink-soft mt-2">
              Min: {fmtNGN(minBorrow)} • Max: {fmtNGN(effectiveMax)}
            </p>
          </div>

          {/* Slider */}
          <div>
            <input
              type="range"
              min={minBorrow}
              max={effectiveMax}
              step={5000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-2 bg-track rounded-full appearance-none cursor-pointer accent-indigo"
            />
            <div className="flex justify-between text-xs text-ink-soft mt-2">
              <span>{fmtNGN(minBorrow)}</span>
              <span>{fmtNGN(effectiveMax)}</span>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex flex-wrap gap-2">
            {[50000, 100000, 200000, 350000].filter((v) => v >= minBorrow && v <= effectiveMax).map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  amount === val
                    ? "bg-indigo text-white"
                    : "bg-parchment text-ink-soft hover:bg-track/30"
                }`}
              >
                {fmtNGN(val)}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              disabled={!canProceed}
              onClick={() => setStep(2)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ STEP 2: REPAYMENT PERIOD ═══ */}
      {step === 2 && (
        <Card variant="elevated" padding="lg" className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-lg text-ink mb-1">Choose repayment period</h2>
            <p className="text-sm text-ink-soft">Select how long you need to repay.</p>
          </div>

          <div className="space-y-2">
            {validTerms.map((option) => (
              <button
                key={option.months}
                onClick={() => setTermMonths(option.months)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition ${
                  termMonths === option.months
                    ? "border-indigo bg-indigo/5"
                    : "border-line bg-paper hover:border-track"
                }`}
              >
                <span className="text-sm font-semibold text-ink">{option.label}</span>
                {termMonths === option.months && (
                  <Check className="w-5 h-5 text-indigo" strokeWidth={2} />
                )}
              </button>
            ))}
          </div>

          {validTerms.length === 0 && (
            <p className="text-sm text-ink-soft text-center py-4">No valid terms for this product.</p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" size="md" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!canProceed}
              onClick={() => setStep(3)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ STEP 3: LIVE CALCULATION SUMMARY ═══ */}
      {step === 3 && calculations && (
        <Card variant="elevated" padding="lg" className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-lg text-ink mb-1">Loan Summary</h2>
            <p className="text-sm text-ink-soft">Here&apos;s what your loan looks like.</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-line/60">
              <span className="text-sm text-ink-soft">Loan Amount</span>
              <span className="font-mono font-semibold text-ink text-sm">{fmtNGN(calculations.principal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/60">
              <span className="text-sm text-ink-soft">Interest ({product.interest_rate}% × {termMonths}mo)</span>
              <span className="font-mono font-semibold text-clay text-sm">{fmtNGN(calculations.totalInterest)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/60">
              <span className="text-sm text-ink-soft">Processing Fee</span>
              <span className="font-mono font-semibold text-ink-soft text-sm">{fmtNGN(calculations.processingFee)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/60">
              <span className="text-sm text-ink-soft">Monthly Repayment</span>
              <span className="font-mono font-semibold text-ink text-sm">{fmtNGN(calculations.monthlyRepayment)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/60">
              <span className="text-sm text-ink-soft">Total Repayment</span>
              <span className="font-mono font-bold text-ink text-sm">{fmtNGN(calculations.totalRepayment)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-ink-soft">You Receive</span>
              <span className="font-mono font-bold text-loam text-sm">{fmtNGN(calculations.disbursement)}</span>
            </div>
          </div>

          <div className="bg-parchment rounded-xl p-3.5">
            <p className="text-xs text-ink-soft">
              Funds will be credited to your AgriqCap wallet instantly upon approval.
            </p>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" size="md" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setStep(4)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ STEP 4: PURPOSE ═══ */}
      {step === 4 && (
        <Card variant="elevated" padding="lg" className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-lg text-ink mb-1">What&apos;s this for?</h2>
            <p className="text-sm text-ink-soft">Select the purpose of your loan.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PURPOSES.map((p) => (
              <button
                key={p}
                onClick={() => setPurpose(p)}
                className={`p-3 rounded-xl border-2 text-sm font-semibold transition ${
                  purpose === p
                    ? "border-indigo bg-indigo/5 text-indigo"
                    : "border-line bg-paper text-ink-soft hover:border-track"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" size="md" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!canProceed}
              onClick={() => setStep(5)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ STEP 5: REVIEW & SUBMIT ═══ */}
      {step === 5 && calculations && (
        <Card variant="elevated" padding="lg" className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-lg text-ink mb-1">Review &amp; Confirm</h2>
            <p className="text-sm text-ink-soft">Please review your application before submitting.</p>
          </div>

          {/* Summary */}
          <div className="bg-paper border border-line rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Product</span>
              <span className="font-semibold text-ink">{product.product_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Loan Amount</span>
              <span className="font-mono font-semibold text-ink">{fmtNGN(calculations.principal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Term</span>
              <span className="font-semibold text-ink">{termMonths} month{termMonths > 1 ? "s" : ""}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Monthly Repayment</span>
              <span className="font-mono font-semibold text-ink">{fmtNGN(calculations.monthlyRepayment)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Total Repayment</span>
              <span className="font-mono font-bold text-ink">{fmtNGN(calculations.totalRepayment)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Purpose</span>
              <span className="font-semibold text-ink">{purpose}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-line/60">
              <span className="text-ink-soft">Disbursement</span>
              <span className="font-semibold text-ink">AgriqCap Wallet</span>
            </div>
          </div>

          {/* Terms checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-indigo cursor-pointer"
            />
            <span className="text-xs text-ink-soft leading-relaxed">
              I agree to the loan terms, including the interest rate, processing fee, and repayment schedule.
              I confirm the information provided is accurate. Funds will be disbursed to my AgriqCap wallet upon approval.
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
              <p className="text-xs text-clay">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-between">
            <Button variant="ghost" size="md" onClick={() => setStep(4)}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!agreed || applyMutation.isPending}
              isLoading={applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
              rightIcon={!applyMutation.isPending ? <ArrowRight className="w-4 h-4" /> : undefined}
            >
              {applyMutation.isPending ? "Submitting…" : "Submit Application"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function LoanApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton variant="text" className="w-24 h-6" />
          <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
        </div>
      }
    >
      <LoanApplyContent />
    </Suspense>
  );
}
