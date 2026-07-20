'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RepayButton({ loanId, amount }: { loanId: string; amount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRepay = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/loans/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Payment failed');
        setLoading(false);
        return;
      }

      // Refresh the page to show updated status
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="text-xs mb-3 p-2.5 rounded-lg" style={{ color: "var(--danger)", background: "rgba(193,57,43,0.08)" }}>
          {error}
        </p>
      )}
      <button
        onClick={handleRepay}
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
        style={{ background: "var(--success)", color: "white" }}
      >
        {loading ? 'Processing…' : `Pay ₦${amount.toLocaleString()}`}
      </button>
    </div>
  );
}
