"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/yield";
import {
  TrendingUp, AlertCircle, Check,
  PiggyBank, Landmark, Activity, ArrowLeft, Info,
} from "lucide-react";
import Link from "next/link";


// Credit score rating
function scoreRating(score: number): { label: string; color: string; description: string } {
  if (score >= 700) return { label: 'Excellent', color: 'text-loam', description: 'You have excellent credit. You can access the best loan terms.' };
  if (score >= 600) return { label: 'Good', color: 'text-loam', description: 'Your credit is good. You qualify for most loan products.' };
  if (score >= 500) return { label: 'Fair', color: 'text-ochre-dim', description: 'Your credit is fair. Improve your savings to unlock better terms.' };
  if (score >= 400) return { label: 'Poor', color: 'text-clay', description: 'Your credit needs improvement. Focus on consistent saving.' };
  return { label: 'No Score', color: 'text-ink-soft', description: 'No credit score yet. Start saving to build your score.' };
}

export default function CreditScorePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["credit-score"],
    queryFn: async () => {
      const res = await fetch("/api/credit-score");
      if (!res.ok) throw new Error("Failed to load credit score");
      return res.json();
    },
  });

  if (isLoading) return <LoadingState message="Loading your credit score…" />;
  if (error) return <ErrorState message="Couldn't load your credit score" onRetry={() => refetch()} />;

  const hasScore = data?.has_score || data?.credit_score;
  const score = data?.credit_score || data?.score || 0;
  const rating = hasScore ? scoreRating(score) : scoreRating(0);
  const breakdown = data?.breakdown;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Back link */}
      <Link href="/loans" className="inline-flex items-center gap-1 text-[14px] text-ink-soft hover:text-ink transition py-2.5 px-1 -mx-1">
        <ArrowLeft className="w-4 h-4" /> Back to loans
      </Link>

      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-[22px] text-ink">Credit Score</h1>
        <p className="text-[14px] text-ink-soft mt-1">
          Your credit score determines your loan eligibility. The higher your score, the more you can borrow.
        </p>
      </div>

      {/* Score display */}
      <div className="bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[12px] text-white/70 uppercase tracking-wide mb-1">Your Credit Score</p>
            <p className="font-mono font-bold text-[48px] leading-tight">{hasScore ? score : "—"}</p>
            <p className={`text-[14px] font-medium mt-1 ${hasScore ? '' : 'text-white/60'}`}>
              {rating.label}
            </p>
          </div>
          <div className="w-20 h-20 rounded-full bg-paper/15 flex items-center justify-center">
            <TrendingUp className="w-10 h-10 text-ochre" strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-[13px] text-white/80 mt-2">
          {hasScore ? rating.description : 'Start saving consistently to build your credit score. Your score is calculated from your savings behavior, repayment history, and account activity.'}
        </p>
      </div>

      {/* Score range visualizer */}
      <div className="bg-paper border border-line rounded-2xl p-5">
        <h3 className="font-display font-semibold text-[15px] text-ink mb-3">Score Range</h3>
        <div className="space-y-2">
          <ScoreRange label="Excellent" range="700-850" color="bg-loam" active={hasScore && score >= 700} />
          <ScoreRange label="Good" range="600-699" color="bg-loam" active={hasScore && score >= 600 && score < 700} />
          <ScoreRange label="Fair" range="500-599" color="bg-ochre" active={hasScore && score >= 500 && score < 600} />
          <ScoreRange label="Poor" range="400-499" color="bg-clay" active={hasScore && score >= 400 && score < 500} />
          <ScoreRange label="No Score" range="0-399" color="bg-parchment" active={!hasScore || score < 400} />
        </div>
      </div>

      {/* Score breakdown — if available */}
      {hasScore && breakdown && (
        <div className="bg-paper border border-line rounded-2xl p-5">
          <h3 className="font-display font-semibold text-[15px] text-ink mb-4">What Makes Up Your Score</h3>
          <div className="space-y-4">
            <ScoreFactor
              icon={PiggyBank}
              title="Savings Score"
              value={breakdown.savings_score || 0}
              max={100}
              description="Based on your savings balance, consistency, and how long you've been saving."
            />
            <ScoreFactor
              icon={Landmark}
              title="Repayment Score"
              value={breakdown.repayment_score || 0}
              max={100}
              description="Based on your loan repayment history — on-time payments increase this score."
            />
            <ScoreFactor
              icon={Activity}
              title="Account Activity Score"
              value={breakdown.participation_score || 0}
              max={100}
              description="Based on how actively you use your wallet and savings accounts."
            />
          </div>
        </div>
      )}

      {/* How to improve */}
      <div className="bg-parchment rounded-2xl p-5">
        <h3 className="font-display font-semibold text-[15px] text-ink mb-3">How to Improve Your Score</h3>
        <div className="space-y-3">
          <ImproveTip
            title="Save consistently"
            description="Regular deposits, even small ones, show financial discipline. Aim to save at least monthly."
          />
          <ImproveTip
            title="Maintain a healthy balance"
            description="Keep your savings balance growing over time. Higher balances contribute to a higher score."
          />
          <ImproveTip
            title="Pay loans on time"
            description="Every on-time repayment increases your repayment score. Late payments lower it."
          />
          <ImproveTip
            title="Complete identity verification"
            description="Verified accounts (BVN + NIN) get a score boost and unlock higher loan limits."
          />
          <ImproveTip
            title="Use your wallet regularly"
            description="Active wallet usage — funding, transfers, and savings — contributes to your activity score."
          />
        </div>
      </div>

      {/* What lowers score */}
      <div className="bg-clay-light rounded-2xl p-5">
        <h3 className="font-display font-semibold text-[15px] text-ink mb-3">What Lowers Your Score</h3>
        <div className="space-y-2">
          <NegativeFactor text="Defaulted loans — each default reduces your score by 100 points" />
          <NegativeFactor text="Late repayments — each late payment reduces your score by 10 points" />
          <NegativeFactor text="Closing savings accounts shortly after opening them" />
          <NegativeFactor text="Long periods of inactivity on your wallet or savings" />
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-loam-light rounded-xl p-4">
        <Info className="w-5 h-5 text-loam flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] text-ink font-medium mb-1">How is this score calculated?</p>
          <p className="text-[13px] text-ink-soft">
            Your credit score is an internal score based entirely on your savings behavior and loan history
            within Agriqcap. It is not a bureau score. It starts at 300 and can go up to 850 based on:
            savings tenure (+200 max), consistency (+150 max), stability (+100 max), minus penalties for
            defaulted loans and late repayments.
          </p>
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/loans"
        className="block w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] text-center hover:opacity-90 transition"
      >
        Check loan eligibility
      </Link>
    </div>
  );
}

function ScoreRange({ label, range, color, active }: { label: string; range: string; color: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-xl transition ${active ? 'bg-paper border border-line' : ''}`}>
      <div className={`w-3 h-3 rounded-full ${color} ${active ? 'ring-2 ring-offset-1 ring-indigo' : ''}`} />
      <span className={`text-[14px] font-medium flex-1 ${active ? 'text-ink' : 'text-ink-soft'}`}>{label}</span>
      <span className="font-mono text-[13px] text-ink-soft">{range}</span>
      {active && <Check className="w-4 h-4 text-loam" />}
    </div>
  );
}

function ScoreFactor({ icon: Icon, title, value, max, description }: { icon: React.ElementType; title: string; value: number; max: number; description: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-8 h-8 rounded-lg bg-parchment flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-baseline">
            <p className="text-[14px] font-medium text-ink">{title}</p>
            <p className="font-mono text-[13px] text-ink-soft">{value}/{max}</p>
          </div>
        </div>
      </div>
      <div className="w-full h-2 bg-parchment rounded-full overflow-hidden ml-10">
        <div className="h-full bg-indigo rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-ink-soft mt-1.5 ml-10">{description}</p>
    </div>
  );
}

function ImproveTip({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-full bg-loam flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
      <div>
        <p className="text-[14px] font-medium text-ink">{title}</p>
        <p className="text-[13px] text-ink-soft mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function NegativeFactor({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-full bg-clay flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlertCircle className="w-3 h-3 text-white" strokeWidth={2.5} />
      </div>
      <p className="text-[13px] text-ink">{text}</p>
    </div>
  );
}
