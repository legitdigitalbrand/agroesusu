'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLoanActions({ loanId }: { loanId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(action);
    setError('');

    try {
      const res = await fetch('/api/loans/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Action failed');
        setLoading(null);
        return;
      }

      router.refresh();
    } catch {
      setError('Something went wrong');
      setLoading(null);
    }
  };

  return (
    <div>
      {error && (
        <p className="text-xs mb-2" style={{ color: "var(--danger)" }}>{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          style={{ background: "var(--success)", color: "white" }}
        >
          {loading === 'approve' ? 'Approving…' : 'Approve & Disburse'}
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={loading !== null}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition border disabled:opacity-50"
          style={{ background: "transparent", color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
