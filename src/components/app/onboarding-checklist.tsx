"use client";

import Link from "next/link";
import { useMe } from "@/hooks/use-me";
import { useQuery } from "@tanstack/react-query";
import {
  Check, User, ShieldCheck, Wallet, PiggyBank, TrendingUp, Landmark,
  ChevronRight, Circle,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Onboarding Checklist
//
// Shows a guided progress flow for new customers:
//   1. Complete Profile
//   2. Verify Identity (KYC)
//   3. Fund Wallet
//   4. Open Savings Account
//   5. Make First Deposit
//   6. Build Credit Score
//   7. Become Loan Eligible
//
// Each step auto-detects completion from /api/me data.
// Completed steps show a green check, incomplete show a link.
// Progress bar at top shows overall completion %.
// ════════════════════════════════════════════════════════════

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  href: string;
  ctaLabel: string;
}

export function OnboardingChecklist() {
  const { data: me } = useMe();

  // Check savings accounts
  const { data: savingsData } = useQuery<{ accounts: unknown[] }>({
    queryKey: ["savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) return { accounts: [] };
      return res.json();
    },
  });

  // Check credit score
  const { data: creditScoreData } = useQuery<{ credit_score?: number }>({
    queryKey: ["credit-score"],
    queryFn: async () => {
      const res = await fetch("/api/credit-score");
      if (!res.ok) return {};
      return res.json();
    },
  });

  if (!me) return null;

  const hasProfile = !!me.profile?.full_name && !!me.profile?.phone;
  const hasKyc = (me.profile?.kyc_level || 0) >= 1;
  const hasWallet = !!me.wallet && me.wallet.available_balance > 0;
  const hasSavings = (savingsData?.accounts?.length || 0) > 0;
  const hasDeposit = hasSavings && (me.summaries?.savings?.total_balance || 0) > 0;
  const hasCreditScore = (creditScoreData?.credit_score || 0) >= 500;
  const hasLoanEligibility = (creditScoreData?.credit_score || 0) >= 600 && hasKyc && hasDeposit;

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Complete Profile",
      description: "Add your name and phone number",
      icon: User,
      completed: hasProfile,
      href: "/profile",
      ctaLabel: "Complete profile",
    },
    {
      id: "kyc",
      title: "Verify Identity",
      description: "Verify with BVN and NIN to unlock all features",
      icon: ShieldCheck,
      completed: hasKyc,
      href: "/onboarding",
      ctaLabel: "Verify identity",
    },
    {
      id: "wallet",
      title: "Fund Wallet",
      description: "Add money to your Agriqcap wallet",
      icon: Wallet,
      completed: hasWallet,
      href: "/wallet/deposit",
      ctaLabel: "Fund wallet",
    },
    {
      id: "savings",
      title: "Open Savings Account",
      description: "Choose a savings product that fits your goals",
      icon: PiggyBank,
      completed: hasSavings,
      href: "/savings",
      ctaLabel: "Open savings",
    },
    {
      id: "deposit",
      title: "Make First Deposit",
      description: "Deposit money from your wallet into savings",
      icon: TrendingUp,
      completed: hasDeposit,
      href: "/savings",
      ctaLabel: "Make deposit",
    },
    {
      id: "credit",
      title: "Build Credit Score",
      description: "Save consistently to improve your credit score",
      icon: TrendingUp,
      completed: hasCreditScore,
      href: "/loans/credit-score",
      ctaLabel: "View credit score",
    },
    {
      id: "eligible",
      title: "Become Loan Eligible",
      description: "Unlock borrowing by meeting all requirements",
      icon: Landmark,
      completed: hasLoanEligibility,
      href: "/loans",
      ctaLabel: "Check eligibility",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);
  const allComplete = completedCount === steps.length;

  // Don't show if all steps are complete
  if (allComplete) return null;

  // Find the next incomplete step
  const nextStep = steps.find((s) => !s.completed);

  return (
    <div className="bg-paper border border-line rounded-2xl overflow-hidden">
      {/* Header with progress */}
      <div className="px-5 py-4 bg-gradient-to-br from-indigo to-indigo-deep text-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-display font-semibold text-[16px]">Getting Started</h3>
            <p className="text-[12px] text-white/70 mt-0.5">
              {completedCount} of {steps.length} steps complete
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-paper/15 flex items-center justify-center">
            <span className="font-mono font-semibold text-[16px]">{progressPct}%</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-paper/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-ochre rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Next action callout */}
      {nextStep && (
        <Link
          href={nextStep.href}
          className="flex items-center gap-3 px-5 py-3.5 bg-ochre-light border-b border-line hover:bg-ochre/20 transition"
        >
          <div className="w-9 h-9 rounded-xl bg-ochre flex items-center justify-center flex-shrink-0">
            <nextStep.icon className="w-[18px] h-[18px] text-indigo-deep" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ink leading-tight">Next: {nextStep.title}</p>
            <p className="text-[12px] text-ink-soft mt-0.5">{nextStep.description}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-ink-soft flex-shrink-0" />
        </Link>
      )}

      {/* Steps list */}
      <div className="px-5 py-3">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 py-2.5 ${i < steps.length - 1 ? "border-b border-line" : ""}`}
          >
            {step.completed ? (
              <div className="w-7 h-7 rounded-full bg-loam flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            ) : (
              <Link href={step.href} className="flex-shrink-0">
                <div className="w-7 h-7 rounded-full border-2 border-line flex items-center justify-center hover:border-indigo transition">
                  <Circle className="w-3 h-3 text-ink-soft" strokeWidth={0} fill="currentColor" />
                </div>
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-[14px] font-medium leading-tight ${step.completed ? "text-ink-soft" : "text-ink"}`}>
                {step.title}
              </p>
              {!step.completed && (
                <p className="text-[12px] text-ink-soft mt-0.5">{step.description}</p>
              )}
            </div>
            {!step.completed && (
              <Link
                href={step.href}
                className="text-[12px] font-medium text-indigo hover:text-indigo-deep transition flex-shrink-0"
              >
                {step.ctaLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
