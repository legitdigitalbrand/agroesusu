'use client';

import { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/icons';

export default function CreateDVAButton({ userId }: { userId: string; initialStatus: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dva, setDva] = useState<{ account_number: string; bank_name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/paystack/dva/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account number');
        setLoading(false);
        return;
      }

      setDva({ account_number: data.account_number, bank_name: data.bank_name });
      setLoading(false);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (dva) {
      navigator.clipboard?.writeText(dva.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (dva) {
    return (
      <div className="rounded-xl p-4" style={{ background: "var(--balance-card-bg)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--balance-card-label)" }}>Your Account</p>
        <div className="flex items-center justify-between mt-2">
          <div>
            <p className="text-xl font-bold tabular-nums" style={{ color: "var(--balance-card-value)" }}>
              {dva.account_number}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--balance-card-label)" }}>{dva.bank_name}</p>
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            style={{ background: "rgba(255,255,255,0.15)", color: "var(--balance-card-value)" }}
          >
            {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--balance-card-label)" }}>
          Transfer to this account to fund your savings instantly
        </p>
      </div>
    );
  }

  // After a failed attempt, don't leave the user staring at a dead button —
  // show a clear, honest status instead (this is almost always the DVA
  // feature not being activated on our Paystack account yet, not something
  // the user did wrong).
  if (error) {
    return (
      <div className="rounded-lg p-4 border" style={{ background: "var(--pending-bg)", borderColor: "transparent" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--pending-text)" }}>Account number generation is temporarily unavailable</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          We&apos;re still finishing setup with our banking partner. Please pay by card below instead — it&apos;s instant and works right now.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
      style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}
    >
      {loading ? 'Creating your account...' : 'Get Account Number'}
    </button>
  );
}
