"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card, ScreenHeader, Button, LoadingState, ErrorState, EmptyState,
  StatusBadge,
} from "@/components/yield";
import { Plus, Calculator } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/format";

interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  interest_rate: number;
  interest_method: string;
  term_months_min: number;
  term_months_max: number;
  max_multiplier: number;
  min_savings_balance: number;
  requires_cooperative: boolean;
  description: string;
}

interface Loan {
  id: string;
  loan_number: string;
  status: string;
  requested_amount: number;
  approved_amount: number | null;
  principal_amount: number | null;
  total_payable: number | null;
  outstanding_balance: number;
  interest_rate: number;
  term_months: number;
  next_due_date: string | null;
  applied_at: string;
  interest_method?: string;
  loan_products?: { product_name: string; product_code: string };
}

export default function LoansPage() {
  const [view, setView] = useState<"loans" | "products">("loans");

  const { data: loansData, isLoading: loansLoading, error: loansError, refetch } = useQuery<{ loans: Loan[] }>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans");
      if (!res.ok) throw new Error("Failed to load loans");
      return res.json();
    },
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: LoanProduct[] }>({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/loans/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const loans = loansData?.loans || [];
  const products = productsData?.products || [];

  return (
    <div className="space-y-5">
      <ScreenHeader
        title="Loans"
        subtitle="Borrow against your savings"
        action={
          <Link href="/loans/apply">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Apply
            </Button>
          </Link>
        }
      />

      {/* Eligibility note */}
      <Card className="bg-indigo/5 border-indigo/20">
        <div className="flex items-start gap-2">
          <Calculator className="h-4 w-4 text-indigo flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-ink">Savings-first lending</p>
            <p className="text-xs text-ink-soft mt-0.5">
              You can borrow up to 3× your eligible savings balance. Keep saving to unlock higher limits.
            </p>
          </div>
        </div>
      </Card>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-parchment rounded-full p-1">
        <button
          onClick={() => setView("loans")}
          className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
            view === "loans" ? "bg-indigo text-white" : "text-ink-soft"
          }`}
        >
          My Loans
        </button>
        <button
          onClick={() => setView("products")}
          className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
            view === "products" ? "bg-indigo text-white" : "text-ink-soft"
          }`}
        >
          Products
        </button>
      </div>

      {view === "loans" ? (
        loansLoading ? (
          <LoadingState message="Loading your loans…" />
        ) : loansError ? (
          <ErrorState message="Couldn't load your loans" onRetry={refetch} />
        ) : loans.length === 0 ? (
          <EmptyState
            title="No loans yet"
            message="Browse our loan products and apply when you're ready."
            action={
              <Link href="/loans/apply">
                <Button>Apply for a loan</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {loans.map((loan) => (
              <Link key={loan.id} href={`/loans/${loan.id}`}>
                <Card className="hover:border-indigo/30 transition cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-serif text-base text-ink">
                        {loan.loan_products?.product_name || "Loan"}
                      </p>
                      <p className="text-xs text-ink-soft mt-0.5">{loan.loan_number}</p>
                    </div>
                    <StatusBadge status={loan.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-ink-soft">Outstanding</p>
                      <p className="font-mono text-base text-ink">
                        {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(loan.outstanding_balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-soft">Rate</p>
                      <p className="font-mono text-base text-ink">{loan.interest_rate}% {loan.interest_method}</p>
                    </div>
                  </div>

                  {loan.next_due_date && (
                    <div className="mt-3 pt-3 border-t border-track/30 flex items-center justify-between">
                      <span className="text-xs text-ink-soft">Next payment</span>
                      <span className="font-mono text-xs text-ink">{formatDate(loan.next_due_date)}</span>
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : (
        productsLoading ? (
          <LoadingState message="Loading products…" />
        ) : products.length === 0 ? (
          <EmptyState title="No loan products available" />
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <Card key={product.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif text-base text-ink">{product.product_name}</h3>
                    <p className="text-xs text-ink-soft mt-0.5">{product.product_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg text-ink">{product.interest_rate}%</p>
                    <p className="text-xs text-ink-soft">{product.interest_method}</p>
                  </div>
                </div>

                <p className="text-sm text-ink-soft mt-2">{product.description}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="bg-parchment text-ink-soft rounded-full px-2.5 py-1">
                    Up to {product.max_multiplier}× savings
                  </span>
                  <span className="bg-parchment text-ink-soft rounded-full px-2.5 py-1">
                    {product.term_months_min}–{product.term_months_max} months
                  </span>
                  {product.requires_cooperative && (
                    <span className="bg-indigo/10 text-indigo rounded-full px-2.5 py-1">Requires cooperative</span>
                  )}
                </div>

                <Link href={`/loans/apply?product=${product.id}`} className="block mt-4">
                  <Button size="sm" className="w-full">Apply now</Button>
                </Link>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
