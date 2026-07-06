'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ContributePanel({
  groupId,
  contributionAmount,
  frequency,
  alreadyContributed,
}: {
  groupId: string;
  contributionAmount: number;
  frequency: string;
  alreadyContributed: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const handleContribute = async () => {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setError('Could not verify your account. Try logging in again.');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/groups/contribute/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, email: user.email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setLoading(false);
      return;
    }

    window.location.href = data.authorization_url;
  };

  if (alreadyContributed) {
    return (
      <div className="rounded-xl p-4 border flex items-center justify-between" style={{ background: "var(--accent-subtle)", borderColor: "var(--border-default)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>✓ You&apos;ve contributed this cycle</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Your Contribution</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>₦{contributionAmount.toLocaleString()} per {frequency}</p>
        </div>
        <button
          onClick={handleContribute}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}
        >
          {loading ? 'Redirecting...' : 'Contribute Now'}
        </button>
      </div>
      {error && (
        <div className="text-sm p-3 rounded-lg border mt-3" style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
