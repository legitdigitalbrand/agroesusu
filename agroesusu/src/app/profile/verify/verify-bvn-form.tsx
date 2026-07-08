'use client';

import { useState } from 'react';
import { ShieldCheckIcon, CheckIcon, AlertTriangleIcon, LockIcon } from '@/components/icons';

export default function VerifyBVNForm({
  userId,
  currentStatus,
  bvnLast4,
  fullName,
}: {
  userId: string;
  currentStatus: string;
  bvnLast4: string | null;
  fullName: string;
}) {
  const [bvn, setBvn] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    if (bvn.length !== 11) {
      setError('BVN must be exactly 11 digits');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/kyc/verify-bvn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bvn, userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }

      setResult({ status: data.status, message: data.message });
      setLoading(false);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  // Already verified
  if (currentStatus === 'verified' && !result) {
    return (
      <div className="rounded-xl p-8 border text-center" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-subtle)" }}>
          <ShieldCheckIcon className="w-7 h-7" style={{ color: "var(--accent)" }} />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Identity Verified</h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Your BVN has been verified. You can withdraw your savings at any time.
        </p>
        {bvnLast4 && (
          <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
            BVN ending in {bvnLast4}
          </p>
        )}
      </div>
    );
  }

  // Pending review
  if (currentStatus === 'pending_review' && !result) {
    return (
      <div className="rounded-xl p-8 border text-center" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(245,184,0,0.12)" }}>
          <AlertTriangleIcon className="w-7 h-7" style={{ color: "var(--color-brand-gold)" }} />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Under Review</h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Your BVN was submitted but the name doesn&apos;t match your registered name. Our team will review and confirm your identity.
        </p>
        <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
          You can still save while we review. Withdrawals will unlock after approval.
        </p>
        {bvnLast4 && (
          <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
            BVN ending in {bvnLast4}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Info card */}
      <div className="rounded-xl p-4 border flex items-start gap-3" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <ShieldCheckIcon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Why we need your BVN</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            We verify your identity through your Bank Verification Number to keep the platform safe. Your BVN is never stored in full — only the last 4 digits and a secure hash.
          </p>
          {fullName && (
            <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
              We&apos;ll check this BVN is registered to <span className="font-medium" style={{ color: "var(--text-muted)" }}>{fullName}</span>.
            </p>
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl p-5 border" style={{
          background: result.status === 'verified' ? "var(--accent-subtle)" : "rgba(245,184,0,0.08)",
          borderColor: result.status === 'verified' ? "var(--accent)" : "rgba(245,184,0,0.3)",
        }}>
          <div className="flex items-start gap-3">
            {result.status === 'verified' ? (
              <CheckIcon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
            ) : (
              <AlertTriangleIcon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-brand-gold)" }} />
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: result.status === 'verified' ? "var(--accent)" : "var(--color-brand-gold)" }}>
                {result.status === 'verified' ? 'Verification Successful' : 'Under Review'}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{result.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {!result && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Bank Verification Number (BVN)
            </label>
            <input
              type="text"
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
              required
              inputMode="numeric"
              placeholder="Enter your 11-digit BVN"
              className="w-full px-4 py-3 rounded-lg border outline-none transition text-lg tracking-wider"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Dial *565*0# on your phone to check your BVN
            </p>
          </div>

          <div className="rounded-lg p-3 border flex items-start gap-2" style={{ background: "var(--accent-subtle)", borderColor: "var(--border-default)" }}>
            <LockIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Your BVN is encrypted and never shared. We only use it to verify your name — no money can be moved with your BVN alone.
            </p>
          </div>

          {error && (
            <div className="text-sm p-3 rounded-lg border"
              style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || bvn.length !== 11}
            className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}
          >
            {loading ? 'Verifying...' : 'Verify Identity'}
          </button>
        </form>
      )}

      {/* Tier info */}
      <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>What you get after verification</h3>
        <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <li className="flex items-start gap-2">
            <CheckIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
            Withdraw your savings anytime
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
            No savings limit (unverified: ₦50,000 max)
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
            Full access to group savings features
          </li>
        </ul>
      </div>
    </div>
  );
}
