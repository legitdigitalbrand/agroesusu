'use client';

import { useState } from 'react';
import { formatNaira } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export default function ContributePanel({
  groupId,
  contributionAmount,
  frequency,
  alreadyContributed,
  hasActiveDirectDebit,
  directDebitPlanId,
}: {
  groupId: string;
  contributionAmount: number;
  frequency: string;
  alreadyContributed: boolean;
  hasActiveDirectDebit?: boolean;
  directDebitPlanId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [ddLoading, setDdLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState('');
  const [ddCancelled, setDdCancelled] = useState(false);
  const supabase = createClient();

  const getUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email || null;
  };

  const handleContribute = async () => {
    setLoading(true);
    setError('');
    const email = await getUserEmail();
    if (!email) { setError('Could not verify your account. Try logging in again.'); setLoading(false); return; }

    const res = await fetch('/api/groups/contribute/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, email }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return; }
    window.location.href = data.authorization_url;
  };

  const handleSetupDirectDebit = async () => {
    setDdLoading(true);
    setError('');
    const email = await getUserEmail();
    if (!email) { setError('Could not verify your account.'); setDdLoading(false); return; }

    const res = await fetch('/api/groups/direct-debit/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, email }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Something went wrong'); setDdLoading(false); return; }
    window.location.href = data.authorization_url;
  };

  const handleCancelDirectDebit = async () => {
    if (!directDebitPlanId) return;
    setCancelLoading(true);
    setError('');
    const res = await fetch('/api/groups/direct-debit/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: directDebitPlanId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed to cancel'); setCancelLoading(false); return; }
    setDdCancelled(true);
    setCancelLoading(false);
  };

  const isDirectDebitActive = hasActiveDirectDebit && !ddCancelled;

  if (alreadyContributed) {
    return (
      <div className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>✓ You&apos;ve contributed this cycle</p>
        </div>

        {/* Still show DD status even if already paid */}
        {isDirectDebitActive ? (
          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Direct Debit Active</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Your next contribution will be automatic
              </p>
            </div>
            <button
              onClick={handleCancelDirectDebit}
              disabled={cancelLoading}
              className="text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 cursor-pointer"
              style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "transparent" }}
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel DD'}
            </button>
          </div>
        ) : ddCancelled ? (
          <p className="text-xs pt-3 border-t" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
            Direct debit cancelled. You&apos;ll need to contribute manually next cycle.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
      {/* Header */}
      <div className="mb-4">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Your Contribution</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {formatNaira(contributionAmount)} per {frequency}
        </p>
      </div>

      {/* Direct Debit active state */}
      {isDirectDebitActive ? (
        <div className="rounded-xl p-4 border mb-4" style={{ background: "var(--accent-subtle)", borderColor: "var(--border-default)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Direct Debit Active</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Your card will be charged automatically every {frequency}. No action needed.
              </p>
            </div>
            <button
              onClick={handleCancelDirectDebit}
              disabled={cancelLoading}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 cursor-pointer"
              style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "transparent" }}
            >
              {cancelLoading ? '...' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Manual contribute */}
          <button
            onClick={handleContribute}
            disabled={loading || ddLoading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 mb-3 cursor-pointer"
            style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}
          >
            {loading ? 'Redirecting...' : 'Contribute Now'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px" style={{ background: "var(--border-default)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>or set it and forget it</span>
            <div className="flex-1 h-px" style={{ background: "var(--border-default)" }} />
          </div>

          {/* Direct Debit setup */}
          <button
            onClick={handleSetupDirectDebit}
            disabled={loading || ddLoading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border transition disabled:opacity-50 cursor-pointer"
            style={{ background: "transparent", borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            {ddLoading ? 'Setting up...' : `Auto-Contribute ${formatNaira(contributionAmount)} / ${frequency}`}
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: "var(--text-muted)" }}>
            Your card is saved once — we charge it automatically each cycle
          </p>
        </>
      )}

      {ddCancelled && !isDirectDebitActive && (
        <p className="text-xs text-center mt-2" style={{ color: "var(--text-muted)" }}>
          Direct debit cancelled. Contribute manually above.
        </p>
      )}

      {error && (
        <div className="text-sm p-3 rounded-lg border mt-3"
          style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
