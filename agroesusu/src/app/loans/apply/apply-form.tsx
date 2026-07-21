'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon, InfoIcon, AlertTriangleIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';
import { LOANS_LIVE_MODE, REPAYMENT_SCHEDULES, calculateLoanInterest, determineAPR } from '@/lib/loans/config';

interface TierData {
  tier: string;
  label: string;
  minAmount: number;
  maxAmount: number;
  aprRange: { min: number; max: number };
  lateFeeFlat: number;
}

interface EligibilityData {
  eligible: boolean;
  tier: TierData | null;
  eligibleAmount: { min: number; max: number };
  reasons: string[];
  blockingIssues: string[];
  creditScore: { total: number } | null;
}

interface Pot {
  id: string;
  name: string;
  current_amount: number;
  type: string;
}

export function ApplyForm({ eligibility, pots }: { eligibility: EligibilityData; pots: Pot[] }) {
  const router = useRouter();
  const tier = eligibility.tier!;

  const [amount, setAmount] = useState(0);
  const [numInstallments, setNumInstallments] = useState(4);
  const [linkedPotId, setLinkedPotId] = useState(pots[0]?.id || '');
  const [esusuPayoutOptIn, setEsusuPayoutOptIn] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Determine actual APR based on user's credit score within their tier
  const creditScore = eligibility.creditScore?.total || 300;
  const apr = determineAPR(tier.tier as 'starter' | 'established' | 'trusted', creditScore);
  const { interestAmount, totalRepayable, effectiveRate } = calculateLoanInterest(amount || 0, apr, numInstallments);
  const installmentAmount = Math.round((totalRepayable / numInstallments) * 100) / 100;
  const firstDueDate = new Date();
  firstDueDate.setDate(firstDueDate.getDate() + 7);

  const handleSubmit = async () => {
    if (!acceptedTerms) {
      setError('Please review and accept the loan terms before applying.');
      return;
    }
    if (!amount || amount < tier.minAmount || amount > tier.maxAmount) {
      setError(`Amount must be between ${formatNaira(tier.minAmount)} and ${formatNaira(tier.maxAmount)}.`);
      return;
    }
    if (!linkedPotId) {
      setError('Please select a savings pot for auto-deduction.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/loans/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          numInstallments,
          linkedPotId,
          esusuPayoutOptIn,
          disbursementAccountId: linkedPotId,
          creditScore,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Application failed');
        setSubmitting(false);
        return;
      }
      router.push('/loans');
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-12 px-4 sm:px-5 lg:px-8 pb-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/loans" className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          <ArrowLeftIcon className="w-4 h-4" /> Back to Loans
        </Link>

        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Apply for a Loan</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          {tier.label} tier · {formatNaira(tier.minAmount)} – {formatNaira(tier.maxAmount)} · {apr}% APR
        </p>

        {!LOANS_LIVE_MODE && (
          <div className="rounded-xl p-3 mb-5 border flex items-start gap-2" style={{ background: "rgba(201,137,31,0.08)", borderColor: "rgba(201,137,31,0.3)" }}>
            <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Sandbox mode — your loan will be credited to your pot as test funds. No real money moves.
            </p>
          </div>
        )}

        {/* Amount */}
        <div className="rounded-xl p-5 mb-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>How much do you want to borrow?</label>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-semibold" style={{ color: "var(--text-muted)" }}>₦</span>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={tier.minAmount}
              max={tier.maxAmount}
              step={1000}
              placeholder={tier.minAmount.toString()}
              className="flex-1 px-4 py-3 rounded-lg border outline-none text-lg font-semibold"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[tier.minAmount, Math.round((tier.minAmount + tier.maxAmount) / 4), Math.round((tier.minAmount + tier.maxAmount) / 2), tier.maxAmount].map((amt, i) => (
              <button
                key={i}
                onClick={() => setAmount(amt)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition border"
                style={{
                  background: amount === amt ? "var(--accent-subtle)" : "transparent",
                  borderColor: amount === amt ? "var(--accent)" : "var(--border-default)",
                  color: amount === amt ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {formatNaira(amt)}
              </button>
            ))}
          </div>
        </div>

        {/* Repayment schedule */}
        <div className="rounded-xl p-5 mb-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Repayment schedule</label>
          <div className="grid grid-cols-3 gap-2">
            {REPAYMENT_SCHEDULES.map((sched) => (
              <button
                key={sched.installments}
                onClick={() => setNumInstallments(sched.installments)}
                className="py-3 rounded-lg text-sm font-medium transition border"
                style={{
                  background: numInstallments === sched.installments ? "var(--accent-subtle)" : "transparent",
                  borderColor: numInstallments === sched.installments ? "var(--accent)" : "var(--border-default)",
                  color: numInstallments === sched.installments ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {sched.installments}
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>weekly</p>
              </button>
            ))}
          </div>
        </div>

        {/* Linked pot */}
        <div className="rounded-xl p-5 mb-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <label className="block text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Auto-deduction pot</label>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Select which savings pot to automatically deduct repayments from on each due date. The loan will also be disbursed into this pot.
          </p>
          <select
            value={linkedPotId}
            onChange={(e) => setLinkedPotId(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border outline-none text-sm font-medium"
            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
          >
            {pots.length === 0 && <option value="">No pots available</option>}
            {pots.map((pot) => (
              <option key={pot.id} value={pot.id}>
                {pot.name} ({formatNaira(Number(pot.current_amount))} balance)
              </option>
            ))}
          </select>
        </div>

        {/* Esusu payout opt-in */}
        <div className="rounded-xl p-5 mb-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={esusuPayoutOptIn}
              onChange={(e) => setEsusuPayoutOptIn(e.target.checked)}
              className="mt-1 w-4 h-4"
              style={{ accentColor: "var(--accent)" }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Link esusu payout as backup</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                If auto-deduction fails, your next esusu group payout can cover the repayment. Completely optional.
              </p>
            </div>
          </label>
        </div>

        {/* Terms summary */}
        {amount > 0 && (
          <div className="rounded-xl p-5 mb-4 border" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)" }}>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--accent)" }}>Loan Terms Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Principal</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(amount)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Interest rate</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{apr}% APR</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Interest amount ({(effectiveRate * 100).toFixed(2)}% effective)</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(interestAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Loan term</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{numInstallments} weeks</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Weekly installment</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(installmentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>First payment due</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {firstDueDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="flex justify-between pt-2 mt-2 border-t" style={{ borderColor: "var(--border-default)" }}>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Total repayment</span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>{formatNaira(totalRepayable)}</span>
              </div>
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              {apr}% APR — you'll repay {formatNaira(totalRepayable)} total over {numInstallments} weeks. Late fee: {formatNaira(tier.lateFeeFlat)} after 3 days grace.
            </p>
          </div>
        )}

        {/* Terms acceptance */}
        <label className="flex items-start gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 w-4 h-4"
            style={{ accentColor: "var(--accent)" }}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            I understand the loan terms including the {apr}% APR, total repayment of {formatNaira(totalRepayable)}, weekly auto-deduction schedule, and late fee policy. I authorize AgroEsusu to deduct repayments from my selected pot.
          </p>
        </label>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !acceptedTerms || !amount}
          className="w-full py-3.5 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          {submitting ? 'Submitting…' : 'Apply for Loan'}
        </button>

        {error && (
          <p className="text-sm mt-3 text-center" style={{ color: "var(--danger)" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
