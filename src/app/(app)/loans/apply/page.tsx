"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingState } from "@/components/yield";
import { ArrowLeft, Check, AlertCircle, Landmark } from "lucide-react";

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  interest_rate: number;
  interest_method: string;
  min_amount: number;
  max_amount: number;
  default_term_months: number;
}

function LoanApplyContent() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const productId = params.get("product");
  const initialAmount = params.get("amount");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: productsData } = useQuery<{ products: LoanProduct[] }>({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/loans/products");
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const product = productsData?.products?.find((p) => p.id === productId);
  const amount = initialAmount ? parseFloat(initialAmount) : 0;

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, amount, term_months: product?.default_term_months }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply for loan");
      return data;
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (!productId) {
    return (
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-clay mx-auto mb-4" />
        <p className="text-[15px] text-ink-soft mb-4">No loan product selected.</p>
        <Link href="/loans" className="inline-block text-[14px] text-indigo hover:underline">
          ← Back to loans
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="bg-paper border border-line rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-loam-light flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-loam" />
          </div>
          <h2 className="font-display font-semibold text-[22px] text-ink mb-2">Application submitted!</h2>
          <p className="text-[15px] text-ink-soft mb-6">
            Your loan application for {fmtNGN(amount)} is now under review. You'll receive a notification once it's approved.
          </p>
          <Link href="/loans" className="inline-block w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] hover:opacity-90 transition">
            View my loans
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return <LoadingState message="Loading product details…" />;
  }

  const monthlyPayment = product.interest_method === "flat"
    ? Math.round((amount + (amount * product.interest_rate / 100 * product.default_term_months / 12)) / product.default_term_months)
    : Math.round(amount / product.default_term_months * (1 + product.interest_rate / 100 / 12));

  const totalRepayment = monthlyPayment * product.default_term_months;
  const totalInterest = totalRepayment - amount;

  return (
    <div className="max-w-md mx-auto">
      <Link href="/loans" className="flex items-center gap-1 text-[14px] text-ink-soft hover:text-ink mb-4 transition">
        <ArrowLeft className="w-4 h-4" /> Back to loans
      </Link>

      <h1 className="font-display font-semibold text-[22px] text-ink mb-1">Loan Application</h1>
      <p className="text-[14px] text-ink-soft mb-6">Review and confirm your loan request</p>

      <div className="border border-line rounded-2xl p-4 bg-paper mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-loam-light flex items-center justify-center">
            <Landmark className="h-5 w-5 text-indigo" strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-medium text-[15px] text-ink">{product.product_name}</p>
            <p className="text-[12px] text-ink-soft">{product.interest_rate}% {product.interest_method === "flat" ? "flat" : "reducing balance"}</p>
          </div>
        </div>

        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-ink-soft">Loan amount</span>
            <span className="font-mono text-ink font-medium">{fmtNGN(amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Term</span>
            <span className="text-ink">{product.default_term_months} months</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-line">
            <span className="text-ink-soft">Monthly repayment</span>
            <span className="font-mono text-ink font-medium">{fmtNGN(monthlyPayment)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Total interest</span>
            <span className="font-mono text-clay">{fmtNGN(totalInterest)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Total repayment</span>
            <span className="font-mono text-ink font-medium">{fmtNGN(totalRepayment)}</span>
          </div>
        </div>
      </div>

      <div className="bg-parchment rounded-xl p-3.5 mb-4">
        <p className="text-[13px] text-ink">
          By applying, you agree to the loan terms. Your application will be reviewed by our team before disbursement.
          Funds will be credited to your wallet upon approval.
        </p>
      </div>

      {error && (
        <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-clay">{error}</p>
        </div>
      )}

      <button
        onClick={() => applyMutation.mutate()}
        disabled={applyMutation.isPending}
        className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {applyMutation.isPending ? (
          <>
            <div className="w-4 h-4 border-2 border-indigo-deep border-t-transparent rounded-full animate-spin" />
            Submitting…
          </>
        ) : (
          `Apply for ${fmtNGN(amount)}`
        )}
      </button>
    </div>
  );
}

export default function LoanApplyPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading…" />}>
      <LoanApplyContent />
    </Suspense>
  );
}
