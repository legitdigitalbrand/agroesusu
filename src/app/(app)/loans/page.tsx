"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  StatusBadge,
  MoneyText,
  ProgressRing,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenHeader,
} from "@/components/yield";
import {
  Landmark,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Clock,
  PiggyBank,
  UserCheck,
  Coins,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Types & Interfaces
// ════════════════════════════════════════════════════════════

interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  interest_rate: number;
  interest_method: string;
  min_amount: number;
  max_amount: number;
  default_term_months: number;
  min_kyc_level: string;
}

interface Loan {
  id: string;
  status: string;
  principal_amount: number;
  outstanding_balance: number;
  next_due_date: string;
  product?: { product_name: string; interest_rate: number };
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
  decision: "approved" | "denied" | "amount_adjusted";
  approved_amount: number;
  factors: EligibilityFactor[];
  credit_score: number;
  savings_balance: number;
  max_eligible_amount: number;
  cooperative_status: string;
  rationale: string;
}

interface CreditScoreData {
  credit_score?: number;
  score?: number;
  has_score?: boolean;
  breakdown?: Record<string, number>;
}

// ════════════════════════════════════════════════════════════
// Human-readable Factor Mapping
// ════════════════════════════════════════════════════════════

const factorLabels: Record<string, string> = {
  savings_balance: "Savings Balance",
  kyc_level: "Identity Verification",
  credit_score: "Credit Score",
  cooperative_membership: "Cooperative Membership",
  savings_tenure: "Savings Tenure",
  wallet_activity: "Wallet Activity",
  repayment_history: "Repayment History",
  account_age: "Account Age",
  consistency: "Savings Consistency",
};

function getFactorImprovement(factor: EligibilityFactor, savingsBalance: number) {
  switch (factor.factor) {
    case "savings_balance": {
      const thresholdNum = typeof factor.threshold === "number" ? factor.threshold : Number(factor.threshold) || 0;
      const needed = Math.max(0, thresholdNum - savingsBalance);
      return {
        text: needed > 0
          ? `Deposit at least ₦${needed.toLocaleString("en-NG")} more into your savings account.`
          : "Build your savings balance to meet the required threshold.",
        href: "/savings",
        linkText: "Deposit Savings",
      };
    }
    case "kyc_level":
      return {
        text: "Complete BVN/NIN identity verification to unlock higher borrowing limits.",
        href: "/profile",
        linkText: "Verify Profile",
      };
    case "credit_score":
      return {
        text: `Increase your credit score to ${factor.threshold} through regular savings and timely repayments.`,
        href: "/savings",
        linkText: "Boost Score",
      };
    case "savings_tenure":
      return {
        text: "Maintain active savings for a longer period to build account tenure.",
        href: "/savings",
        linkText: "View Savings",
      };
    case "cooperative_membership":
      return {
        text: "Join an esusu group or cooperative to unlock this loan product. Cooperative membership demonstrates community trust and shared savings discipline.",
        href: "/cooperatives",
        linkText: "Explore Groups",
      };
    case "repayment_history":
      return {
        text: "Ensure previous loans are repaid on time to maintain a strong repayment history.",
        href: "/loans",
        linkText: "Manage Loans",
      };
    case "wallet_activity":
      return {
        text: "Fund and use your Agriqcap wallet regularly for active transactions.",
        href: "/savings",
        linkText: "Fund Wallet",
      };
    default:
      return {
        text: `Improve your ${factorLabels[factor.factor] || factor.factor} to qualify for higher limits.`,
        href: "/savings",
        linkText: "Take Action",
      };
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ════════════════════════════════════════════════════════════
// Main Page Component
// ════════════════════════════════════════════════════════════

export default function LoansPage() {
  const [activeTab, setActiveTab] = useState<"products" | "loans">("products");

  // Data Query: Active / Past Loans
  const loansQuery = useQuery<{ loans: Loan[] }>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not fetch loans");
      }
      return res.json();
    },
  });

  // Data Query: Loan Products
  const productsQuery = useQuery<{ products: LoanProduct[] }>({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/loans/products");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not fetch loan products");
      }
      return res.json();
    },
  });

  // Data Query: Credit Score
  const creditScoreQuery = useQuery<CreditScoreData>({
    queryKey: ["credit-score"],
    queryFn: async () => {
      const res = await fetch("/api/credit-score");
      if (!res.ok) {
        return { credit_score: 0, has_score: false };
      }
      return res.json();
    },
  });

  const products = productsQuery.data?.products || [];
  const loans = loansQuery.data?.loans || [];

  // Parallel Queries: Eligibility for each product
  const eligibilityQueries = useQueries({
    queries: products.map((prod) => ({
      queryKey: ["loan-eligibility", prod.id],
      queryFn: async () => {
        const res = await fetch(`/api/loans/eligibility?product_id=${prod.id}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Could not check eligibility");
        }
        return res.json() as Promise<EligibilityResult>;
      },
      enabled: !!prod.id,
    })),
  });

  // Global API Error handling
  if (loansQuery.isError) {
    return (
      <ErrorState
        message={loansQuery.error instanceof Error ? loansQuery.error.message : "Failed to load active loans"}
        onRetry={() => loansQuery.refetch()}
      />
    );
  }

  if (productsQuery.isError) {
    return (
      <ErrorState
        message={productsQuery.error instanceof Error ? productsQuery.error.message : "Failed to load loan products"}
        onRetry={() => productsQuery.refetch()}
      />
    );
  }

  const isLoadingInitial = loansQuery.isLoading || productsQuery.isLoading;

  if (isLoadingInitial) {
    return <LoadingState message="Loading your loans and credit status…" />;
  }

  // Derive eligibility insights across products
  const eligibilityDataMap: Record<string, EligibilityResult | undefined> = {};
  products.forEach((prod, index) => {
    eligibilityDataMap[prod.id] = eligibilityQueries[index]?.data;
  });

  const allResults = Object.values(eligibilityDataMap).filter((r): r is EligibilityResult => Boolean(r));

  // Highest credit score found across endpoints or results
  const creditScoreFromApi = creditScoreQuery.data?.credit_score || creditScoreQuery.data?.score || 0;
  const creditScoreFromResults = allResults.find((r) => r.credit_score > 0)?.credit_score || 0;
  const effectiveCreditScore = Math.max(creditScoreFromApi, creditScoreFromResults);

  // Maximum eligible amount across all products
  const maxEligibleAmount = Math.max(
    ...allResults.map((r) => r.max_eligible_amount || r.approved_amount || 0),
    0
  );

  // Determine overall status
  const hasApprovedProduct = allResults.some(
    (r) => r.decision === "approved" || r.decision === "amount_adjusted"
  );
  const overallStatus = hasApprovedProduct ? "approved" : allResults.length > 0 ? "denied" : "pending";

  // Primary result to extract factors (prefer approved, else first result)
  const primaryResult = allResults.find((r) => r.decision === "approved" || r.decision === "amount_adjusted") || allResults[0];

  return (
    <div className="space-y-6">
      {/* Screen Header */}
      <ScreenHeader
        title="Loans & Credit Eligibility"
        subtitle="Check your borrowing capacity, monitor your credit factors, and access instant business financing."
        action={
          <Link href="/loans/credit-score">
            <Button variant="outline" size="sm" leftIcon={<TrendingUp className="w-4 h-4 text-indigo" />}>
              Credit Details
            </Button>
          </Link>
        }
      />

      {/* ── SECTION 1: Overall Eligibility & Credit Score ── */}
      <Card variant="dark" padding="lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Credit Score Progress Ring */}
          <div className="flex items-center gap-5">
            <ProgressRing
              progress={Math.min(100, Math.max(0, Math.round((effectiveCreditScore / 850) * 100)))}
              size={100}
              strokeWidth={8}
              variant={effectiveCreditScore >= 600 ? "loam" : effectiveCreditScore >= 500 ? "ochre" : "indigo"}
              label={effectiveCreditScore > 0 ? String(effectiveCreditScore) : "—"}
              sublabel="Score / 850"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={overallStatus} size="sm" />
                <span className="text-xs text-white/80">Internal Score</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
                {hasApprovedProduct ? "Eligible for Credit" : "Improve Eligibility"}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-md">
                Based on your Agriqcap savings history, wallet activity, and identity status.
              </p>
            </div>
          </div>

          {/* Max Eligible Amount Box */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 text-right w-full md:w-auto">
            <p className="text-xs text-white/80 uppercase tracking-wider font-medium mb-1">
              Max Eligible Amount
            </p>
            <MoneyText amount={maxEligibleAmount} size="2xl" className="text-ochre" />
            <p className="text-[11px] text-white/80 mt-1">
              {hasApprovedProduct ? "Instant disbursement available" : "Boost savings to unlock"}
            </p>
          </div>
        </div>

        {/* Factors Breakdown & How to Improve inside Primary Eligibility */}
        {primaryResult && (
          <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WHY Eligible / Not Eligible */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-white/90 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-ochre" /> Requirement Factors
                </h3>
                <span className="text-[11px] text-white/80">
                  {primaryResult.factors.filter((f) => f.passed).length} of {primaryResult.factors.length} Passed
                </span>
              </div>
              <div className="space-y-2">
                {primaryResult.factors.map((f, i) => {
                  const label = factorLabels[f.factor] || f.factor;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/10 last:border-b-0">
                      <div className="flex items-center gap-2 text-white/90">
                        {f.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-ochre shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-clay-light shrink-0" />
                        )}
                        <span>{label}</span>
                      </div>
                      <span className={`font-mono ${f.passed ? "text-white" : "text-clay-light"}`}>
                        {f.factor === "cooperative_membership"
                          ? (f.passed ? "Member" : "Not a member")
                          : `${String(f.value || "—")} ${f.threshold ? `/ ${f.threshold}` : ""}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* HOW to Improve */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-4">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-white/90 mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-ochre" /> Actionable Next Steps
              </h3>
              <div className="space-y-2.5">
                {primaryResult.factors.filter((f) => !f.passed).length > 0 ? (
                  primaryResult.factors
                    .filter((f) => !f.passed)
                    .map((f, i) => {
                      const imp = getFactorImprovement(f, primaryResult.savings_balance);
                      return (
                        <div key={i} className="flex items-start justify-between gap-3 text-xs text-white/80 bg-white/10 p-3 rounded-lg border border-white/15">
                          <p className="flex-1 leading-relaxed">{imp.text}</p>
                          <Link href={imp.href} className="text-ochre hover:underline shrink-0 font-semibold flex items-center gap-1">
                            {imp.linkText} <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-xs text-white/80 space-y-2">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-ochre shrink-0" /> You meet all standard eligibility criteria!
                    </p>
                    <p className="text-[11px] text-white/80">
                      Keep your savings consistent to maintain and grow your maximum borrowing capacity.
                    </p>
                    <div className="pt-2 flex gap-3">
                      <Link href="/savings" className="text-ochre hover:underline font-semibold flex items-center gap-1">
                        Go to Savings <ArrowRight className="w-3 h-3" />
                      </Link>
                      <Link href="/profile" className="text-ochre hover:underline font-semibold flex items-center gap-1">
                        View Profile <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-line gap-4">
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeTab === "products" ? "text-indigo border-b-2 border-indigo" : "text-ink-soft hover:text-ink"
          }`}
        >
          Available Loan Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("loans")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeTab === "loans" ? "text-indigo border-b-2 border-indigo" : "text-ink-soft hover:text-ink"
          }`}
        >
          My Active Loans ({loans.length})
        </button>
      </div>

      {/* ── SECTION 2: Available Loan Products ── */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {products.length === 0 ? (
            <EmptyState
              title="No Loan Products Available"
              message="Check back soon for new agricultural credit and savings-backed loan offers."
              icon={<Landmark className="w-6 h-6 text-ink-soft" />}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {products.map((product, idx) => {
                const eligibility = eligibilityQueries[idx]?.data;
                const isQueryLoading = eligibilityQueries[idx]?.isLoading;
                const isEligible = eligibility?.decision === "approved" || eligibility?.decision === "amount_adjusted";

                return (
                  <Card
                    key={product.id}
                    variant={isEligible ? "light" : "flat"}
                    className={!isEligible ? "bg-parchment/40 border-line/80" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEligible ? "bg-loam-light text-indigo" : "bg-track text-ink-soft"}`}>
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle>{product.product_name}</CardTitle>
                            <CardDescription>
                              {product.interest_rate}% {product.interest_method === "flat" ? "Flat Rate" : "Reducing"} · {product.default_term_months} Months Term
                            </CardDescription>
                          </div>
                        </div>
                        <StatusBadge
                          status={isQueryLoading ? "pending" : isEligible ? "approved" : "denied"}
                          size="sm"
                        />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Product Limits */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-parchment/60 p-4 rounded-xl border border-line/60">
                        <div>
                          <p className="text-[11px] text-ink-soft font-medium">Borrow Limit</p>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <MoneyText amount={product.min_amount || 0} size="sm" className="text-ink-soft" />
                            <span className="text-xs text-ink-soft">-</span>
                            <MoneyText amount={product.max_amount || 0} size="sm" className="text-ink" />
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] text-ink-soft font-medium">Approved Maximum</p>
                          {eligibility ? (
                            <MoneyText
                              amount={eligibility.approved_amount || eligibility.max_eligible_amount || 0}
                              size="sm"
                              className={isEligible ? "text-loam font-bold" : "text-clay font-bold"}
                            />
                          ) : (
                            <span className="text-xs text-ink-soft font-mono">Checking…</span>
                          )}
                        </div>
                      </div>

                      {/* Eligibility Explanation */}
                      {isQueryLoading ? (
                        <div className="py-2 text-xs text-ink-soft flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 animate-spin text-indigo" /> Evaluating qualification requirements…
                        </div>
                      ) : isEligible ? (
                        <div className="space-y-2">
                          <p className="text-xs text-loam font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-loam shrink-0" />
                            You qualify for up to <MoneyText amount={eligibility?.max_eligible_amount || product.max_amount} size="sm" className="text-loam" />
                          </p>
                        </div>
                      ) : (
                        <div className="bg-clay-light/50 border border-clay/20 p-3.5 rounded-xl space-y-2.5">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-clay shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-clay">Not Eligible Yet</p>
                              <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">
                                {eligibility?.rationale || "You do not meet the minimum requirements for this product."}
                              </p>
                            </div>
                          </div>

                          {/* Detailed factors failure */}
                          {eligibility?.factors && eligibility.factors.some((f) => !f.passed) && (
                            <div className="pt-2 border-t border-clay/15 space-y-1.5">
                              <p className="text-[11px] font-semibold text-ink uppercase tracking-wider">
                                Required Fixes:
                              </p>
                              {eligibility.factors
                                .filter((f) => !f.passed)
                                .map((f, i) => {
                                  const imp = getFactorImprovement(f, eligibility.savings_balance);
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs text-ink bg-paper p-2 rounded-lg border border-line">
                                      <span>{imp.text}</span>
                                      <Link href={imp.href} className="text-indigo hover:underline font-semibold shrink-0 ml-2">
                                        {imp.linkText}
                                      </Link>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>

                    <CardFooter>
                      {isEligible ? (
                        <Link href={`/loans/apply?product=${product.id}`} className="w-full">
                          <Button variant="primary" fullWidth rightIcon={<ArrowRight className="w-4 h-4" />}>
                            Apply for {product.product_name}
                          </Button>
                        </Link>
                      ) : (
                        <div className="flex gap-2 w-full">
                          <Link href="/savings" className="flex-1">
                            <Button variant="outline" size="sm" fullWidth leftIcon={<PiggyBank className="w-4 h-4 text-indigo" />}>
                              Boost Savings
                            </Button>
                          </Link>
                          <Link href="/profile" className="flex-1">
                            <Button variant="outline" size="sm" fullWidth leftIcon={<UserCheck className="w-4 h-4 text-indigo" />}>
                              Verify KYC
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 3: Active Loans ── */}
      {activeTab === "loans" && (
        <div className="space-y-4">
          {loans.length === 0 ? (
            <EmptyState
              title="No Active Loans"
              message="You currently have no active or pending loan disbursements."
              icon={<Coins className="w-6 h-6 text-ink-soft" />}
              action={
                <Button variant="primary" onClick={() => setActiveTab("products")} leftIcon={<ShieldCheck className="w-4 h-4" />}>
                  Check Available Products
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {loans.map((loan) => {
                const principal = loan.principal_amount || 0;
                const outstanding = loan.outstanding_balance || 0;
                const paid = Math.max(0, principal - outstanding);
                const progress = principal > 0 ? Math.min(100, Math.max(0, Math.round((paid / principal) * 100))) : 0;

                return (
                  <Card key={loan.id} variant="light">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{loan.product?.product_name || "Loan Facility"}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5 text-ink-soft" /> Next Due: {formatDate(loan.next_due_date)}
                          </CardDescription>
                        </div>
                        <StatusBadge status={loan.status} />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Numbers Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-parchment/60 p-4 rounded-xl border border-line/60">
                        <div>
                          <p className="text-[11px] text-ink-soft font-medium">Principal Amount</p>
                          <MoneyText amount={principal} size="md" className="text-ink" />
                        </div>
                        <div>
                          <p className="text-[11px] text-ink-soft font-medium">Outstanding Balance</p>
                          <MoneyText amount={outstanding} size="md" className={outstanding > 0 ? "text-clay font-bold" : "text-loam font-bold"} />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                          <span className="text-ink-soft">Repayment Progress</span>
                          <span className="text-indigo font-mono">{progress}% Paid</span>
                        </div>
                        <div className="w-full h-2.5 bg-track rounded-full overflow-hidden">
                          <div
                            className="h-full bg-loam rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-ink-soft mt-1">
                          <span>Paid: <MoneyText amount={paid} size="sm" className="text-loam font-medium" /></span>
                          <span>Total: <MoneyText amount={principal} size="sm" className="text-ink font-medium" /></span>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Link href={`/loans/${loan.id}`} className="w-full">
                        <Button variant="outline" fullWidth rightIcon={<ChevronRight className="w-4 h-4" />}>
                          View Details & Repay
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
