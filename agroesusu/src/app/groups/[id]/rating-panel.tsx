'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  user_id: string;
  full_name: string;
}

export default function RatingPanel({ groupId, members }: { groupId: string; members: Member[] }) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [rated, setRated] = useState<Record<string, number>>({});
  const router = useRouter();

  const submitRating = async (rateeId: string, rating: number) => {
    setSubmitting(rateeId);
    const res = await fetch('/api/groups/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, ratee_id: rateeId, rating }),
    });
    setSubmitting(null);
    if (res.ok) {
      setRated((prev) => ({ ...prev, [rateeId]: rating }));
      router.refresh();
    }
  };

  if (members.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Rate Members</h2>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Rate reliability based on this cycle&apos;s contributions and payouts.</p>
      <div className="rounded-xl border divide-y" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between p-4" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{m.full_name}</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  disabled={submitting === m.user_id}
                  onClick={() => submitRating(m.user_id, star)}
                  className="text-lg leading-none transition disabled:opacity-50"
                  style={{ color: (rated[m.user_id] || 0) >= star ? "var(--color-brand-gold)" : "var(--text-faint)" }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
