'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon, InfoIcon, AlertTriangleIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';
import { LOANS_LIVE_MODE, REPAYMENT_SCHEDULES } from '@/lib/loans/config';

interface TierData {
  tier: string;
  label: string;
  minAmount: number;
  maxAmount: number;
  flatInterestRate: number;
  lateFeeFlat: number;
}

interface EligibilityData {
  eligible: boolean;
  tier: TierData | null;
  eligibleAmount: { min: number; max: number };
  reasons: string[];
  blockingIssues: string[];
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

  const interestAmount = Math.round((amount * tier.flatInterestRate / 100) * 100) / 100;
  const totalRepayable = amount + interestAmount;
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
          {tier.label} tier · {formatNaira(tier.minAmount)} – {formatNaira(tier.maxAmount)} · {tier.flatInterestRate}% flat interest
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
                <span style={{ color: "var(--text-secondary)" }}>Interest ({tier.flatInterestRate}% flat)</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(interestAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <span className="font-semibold" style={{ color: "var(--accent)" }}>Total Repayable</span>
                <span className="font-bold" style={{ color: "var(--accent)" }}>{formatNaira(totalRepayable)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Weekly payment</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{formatNaira(installmentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>First due date</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {firstDueDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Late fee (after 3-day grace)</span>
                <span className="font-medium" style={{ color: "var(--warning)" }}>{formatNaira(tier.lateFeeFlat)}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>If you miss a payment:</p>
              <ul className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <li>• Days 1–3: Grace period — we'll retry + remind you</li>
                <li>• Day 4+: {formatNaira(tier.lateFeeFlat)} late fee + temporary restriction on new loans/pots</li>
                <li>• Day 14+: Our team will contact you to arrange repayment</li>
                <li>• Your savings are never locked as punishment</li>
              </ul>
            </div>

            <label className="flex items-start gap-2 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-4 h-4"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                I understand and accept these terms, including the repayment schedule and late fee policy.
              </span>
            </label>
          </div>
        )}

        {error && (
          <div className="text-sm p-3 rounded-lg border mb-4" style={{ background: "rgba(193,57,43,0.08)", color: "var(--danger)", borderColor: "rgba(193,57,43,0.2)" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !amount || !linkedPotId || !acceptedTerms}
          className="w-full py-3.5 rounded-lg font-semibold transition disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--hero-text)" }}
        >
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}
