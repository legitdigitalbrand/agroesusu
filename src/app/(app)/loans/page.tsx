"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  Card,
  StatusBadge,
  Skeleton,
  CardSkeleton,
} from "@/components/yield";
import {
  Landmark,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  Calendar,
  Sparkles,
  ShieldCheck,
  PiggyBank,
  Briefcase,
  Tractor,
  Zap,
  Clock,
  CheckCircle2,
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

interface Loan {
  id: string;
  loan_number: string;
  status: string;
  requested_amount: number;
  approved_amount: number | null;
  principal_amount: number | null;
  outstanding_balance: number;
  total_interest: number;
  total_payable: number;
  interest_rate: number;
  term_months: number;
  next_due_date: string | null;
  created_at: string;
  product_id: string;
}

interface EligibilityResult {
  decision: "approved" | "denied" | "amount_adjusted";
  approved_amount: number;
  credit_score: number;
  max_eligible_amount: number;
  rationale: string;
}

// ─────────────────────────────────────────────────────────────
// Product icon mapping
// ─────────────────────────────────────────────────────────────
function getProductIcon(type: string) {
  switch (type) {
    case "salary":
      return Briefcase;
    case "sme":
      return TrendingUp;
    case "agricultural":
      return Tractor;
    default:
      return Landmark;
  }
}

function getProductGradient(type: string) {
  switch (type) {
    case "salary":
      return "from-indigo to-indigo-deep";
    case "sme":
      return "from-loam to-loam-dim";
    case "agricultural":
      return "from-indigo to-loam";
    default:
      return "from-indigo to-indigo-deep";
  }
}

// ─────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────
const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

function formatRelativeDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
function LoansSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton variant="text" className="w-32 h-8" />
        <Skeleton variant="text" className="w-80 h-4" />
      </div>
      <Skeleton variant="rectangular" className="h-40 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <Skeleton variant="rectangular" className="h-64 rounded-2xl" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function LoansPage() {
  const [showAllProducts, setShowAllProducts] = useState(false);

  // ── Queries (same APIs, no changes) ──
  const productsQuery = useQuery<{ products: LoanProduct[] }>({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/loans/products");
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const loansQuery = useQuery<{ loans: Loan[] }>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans");
      if (!res.ok) return { loans: [] };
      return res.json();
    },
  });

  const products = productsQuery.data?.products || [];
  const loans = loansQuery.data?.loans || [];

  // Eligibility queries (one per product)
  const eligibilityQueries = useQueries({
    queries: products.map((prod) => ({
      queryKey: ["loan-eligibility", prod.id],
      queryFn: async () => {
        const res = await fetch(`/api/loans/eligibility?product_id=${prod.id}`);
        if (!res.ok) return null;
        return res.json() as Promise<EligibilityResult>;
      },
      enabled: !!prod.id,
    })),
  });

  const isLoading = productsQuery.isLoading || loansQuery.isLoading;

  if (isLoading) return <LoansSkeleton />;

  // Derive overall eligibility
  const eligibilityMap: Record<string, EligibilityResult | null> = {};
  products.forEach((prod, i) => {
    eligibilityMap[prod.id] = eligibilityQueries[i]?.data ?? null;
  });

  const allResults = Object.values(eligibilityMap).filter((r): r is EligibilityResult => r !== null);
  const hasApproved = allResults.some((r) => r.decision === "approved" || r.decision === "amount_adjusted");
  const maxEligibleAmount = Math.max(
    ...allResults.map((r) => r.max_eligible_amount || r.approved_amount || 0),
    0
  );

  // Active/past loans
  const activeLoans = loans.filter((l) =>
    ["applied", "pending", "approved", "disbursed", "active", "overdue"].includes(l.status)
  );
  const pastLoans = loans.filter((l) =>
    ["closed", "defaulted", "denied", "written_off"].includes(l.status)
  );
  const allApplications = [...activeLoans, ...pastLoans];

  // Products to show (max 4)
  const visibleProducts = showAllProducts ? products : products.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* ═══ SECTION 1: HERO ═══ */}
      <div className="space-y-1">
        <h1 className="font-display font-bold text-3xl text-ink tracking-tight">Loans</h1>
        <p className="text-base text-ink-soft leading-relaxed max-w-xl">
          Borrow when you need it. Repay comfortably. Build your credit history with every successful repayment.
        </p>
      </div>

      {/* ═══ SECTION 2: ELIGIBILITY SUMMARY CARD ═══ */}
      {hasApproved ? (
        <Card variant="dark" padding="lg" className="relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-ochre/5 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-ochre" strokeWidth={2} />
                <span className="text-sm font-semibold text-white/90">Congratulations — you&apos;re eligible</span>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Borrow up to</p>
                <p className="text-4xl font-bold font-mono text-white">{fmtNGN(maxEligibleAmount)}</p>
              </div>
            </div>
            <Link href={`/loans/apply?product=${products[0]?.id}&amount=${maxEligibleAmount}`}>
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-ochre text-indigo-deep font-semibold text-sm hover:opacity-90 transition shadow-sm whitespace-nowrap">
                Apply Now <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </span>
            </Link>
          </div>
        </Card>
      ) : (
        <Card variant="elevated" padding="lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-parchment flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo" strokeWidth={1.8} />
                </div>
                <span className="text-sm font-semibold text-ink">You&apos;re building your credit profile</span>
              </div>
              <div>
                <p className="text-xs text-ink-soft mb-1">Current eligibility</p>
                <p className="text-base font-semibold text-ink-soft">Not eligible yet</p>
                <p className="text-sm text-ink-soft mt-1">Save consistently to unlock borrowing.</p>
              </div>
            </div>
            <Link href="/savings">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo text-white font-semibold text-sm hover:bg-indigo-deep transition whitespace-nowrap">
                Improve Eligibility
              </span>
            </Link>
          </div>
        </Card>
      )}

      {/* ═══ SECTION 3: AVAILABLE LOAN PRODUCTS ═══ */}
      {visibleProducts.length > 0 && (
        <div className="space-y-5">
          <h2 className="font-display font-semibold text-xl text-ink">Available Loan Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {visibleProducts.map((product) => {
              const Icon = getProductIcon(product.product_type);
              const elig = eligibilityMap[product.id];
              const canApply = elig?.decision === "approved" || elig?.decision === "amount_adjusted";
              const maxBorrow = elig?.max_eligible_amount || elig?.approved_amount || product.min_amount;

              return (
                <Card
                  key={product.id}
                  variant="interactive"
                  padding="lg"
                  className="flex flex-col group hover:scale-[1.01] transition-transform duration-200"
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getProductGradient(product.product_type)} flex items-center justify-center mb-4 shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" strokeWidth={1.8} />
                  </div>

                  {/* Name + description */}
                  <h3 className="font-display font-semibold text-base text-ink mb-1">{product.product_name}</h3>
                  <p className="text-xs text-ink-soft leading-relaxed mb-4 flex-1">
                    {product.description || "Flexible financing to meet your needs."}
                  </p>

                  {/* Terms */}
                  <div className="space-y-1.5 mb-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-soft">Up to</span>
                      <span className="font-mono font-semibold text-ink">{fmtNGN(product.max_amount || maxBorrow)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-soft">Interest</span>
                      <span className="font-semibold text-ink">From {product.interest_rate}% monthly</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-soft">Repayment</span>
                      <span className="font-semibold text-ink">
                        {product.min_term_months === product.max_term_months
                          ? `${product.min_term_months} mo`
                          : `${product.min_term_months}–${product.max_term_months} mo`}
                      </span>
                    </div>
                  </div>

                  {/* Apply button */}
                  <Link href={`/loans/apply?product=${product.id}&amount=${canApply ? maxBorrow : product.min_amount}`}>
                    <span className={`w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm transition ${
                      canApply
                        ? "bg-ochre text-indigo-deep hover:opacity-90"
                        : "bg-parchment text-ink-soft hover:bg-track/30"
                    }`}>
                      {canApply ? "Apply" : "View"} <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </span>
                  </Link>
                </Card>
              );
            })}
          </div>
          {products.length > 4 && (
            <div className="text-center">
              <button
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="text-sm font-semibold text-indigo hover:text-indigo-deep transition"
              >
                {showAllProducts ? "Show fewer" : `Show all ${products.length} products`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ SECTION 4: MY APPLICATIONS ═══ */}
      <div className="space-y-5">
        <h2 className="font-display font-semibold text-xl text-ink">My Applications</h2>

        {allApplications.length === 0 ? (
          /* Empty state */
          <Card variant="elevated" padding="lg" className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-parchment flex items-center justify-center mx-auto mb-4">
              <Landmark className="w-8 h-8 text-ink-soft" strokeWidth={1.5} />
            </div>
            <p className="text-base font-semibold text-ink mb-1">No active loans</p>
            <p className="text-sm text-ink-soft mb-6 max-w-sm mx-auto">
              When you&apos;re eligible you can apply for a loan in minutes.
            </p>
            {products.length > 0 && (
              <Link href={`/loans/apply?product=${products[0]?.id}`}>
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo text-white font-semibold text-sm hover:bg-indigo-deep transition">
                  Explore Loan Products <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </span>
              </Link>
            )}
          </Card>
        ) : (
          /* Timeline */
          <div className="space-y-3">
            {allApplications.map((loan) => (
              <Link key={loan.id} href={`/loans/${loan.id}`}>
                <Card
                  variant="interactive"
                  padding="md"
                  className="flex items-center justify-between gap-4 group hover:scale-[1.005] transition-transform duration-200"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      loan.status === "active" || loan.status === "disbursed"
                        ? "bg-loam-light text-loam"
                        : loan.status === "approved"
                        ? "bg-loam-light text-loam"
                        : loan.status === "denied" || loan.status === "defaulted"
                        ? "bg-clay-light text-clay"
                        : loan.status === "closed"
                        ? "bg-track/50 text-indigo"
                        : "bg-ochre-light text-indigo-deep"
                    }`}>
                      {loan.status === "active" || loan.status === "disbursed" ? (
                        <Briefcase className="w-5 h-5" strokeWidth={1.8} />
                      ) : loan.status === "denied" ? (
                        <Zap className="w-5 h-5" strokeWidth={1.8} />
                      ) : (
                        <Clock className="w-5 h-5" strokeWidth={1.8} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {loan.loan_number || "Loan Application"}
                      </p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        {formatRelativeDate(loan.created_at)} • {fmtNGN(loan.approved_amount || loan.requested_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Status + arrow */}
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={loan.status} size="sm" />
                    <ChevronRight className="w-4 h-4 text-ink-soft group-hover:text-ink transition" strokeWidth={2} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ═══ NOT ELIGIBLE: ENCOURAGING TIPS ═══ */}
      {!hasApproved && allResults.length > 0 && (
        <Card variant="elevated" padding="lg" className="bg-parchment">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo" strokeWidth={1.8} />
              <h3 className="font-display font-semibold text-base text-ink">You&apos;re getting closer</h3>
            </div>
            <p className="text-sm text-ink-soft">To unlock borrowing, we recommend:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-loam-light flex items-center justify-center shrink-0">
                  <PiggyBank className="w-4 h-4 text-loam" strokeWidth={1.8} />
                </div>
                <span className="text-sm text-ink">Save consistently</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-loam-light flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-loam" strokeWidth={1.8} />
                </div>
                <span className="text-sm text-ink">Complete identity verification</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-loam-light flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-loam" strokeWidth={1.8} />
                </div>
                <span className="text-sm text-ink">Maintain positive wallet activity</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-loam-light flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-loam" strokeWidth={1.8} />
                </div>
                <span className="text-sm text-ink">Build savings history</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ TRUST FOOTER ═══ */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <ShieldCheck className="w-4 h-4 text-ink-soft" strokeWidth={1.5} />
        <p className="text-xs text-ink-soft">Powered by Safe Haven MFB — CBN-licensed &amp; NDIC-insured</p>
      </div>
    </div>
  );
}
