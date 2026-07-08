'use client';

import { useState } from 'react';
import { formatNaira } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface FundRequest {
  id: string;
  requester_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
  profiles?: { full_name?: string };
  votes?: { voter_id: string; approve: boolean }[];
}

export default function EmergencyFundPanel({
  groupId,
  poolTotal,
  requests,
  userId,
  isMember,
}: {
  groupId: string;
  poolTotal: number;
  requests: FundRequest[];
  userId: string;
  isMember: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [votingId, setVotingId] = useState<string | null>(null);
  const router = useRouter();

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/groups/emergency/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, amount: Number(amount), reason }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setLoading(false);
      return;
    }

    setShowForm(false);
    setAmount('');
    setReason('');
    setLoading(false);
    router.refresh();
  };

  const handleVote = async (requestId: string, approve: boolean) => {
    setVotingId(requestId);
    const res = await fetch('/api/groups/emergency/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, approve }),
    });
    const data = await res.json();
    setVotingId(null);
    if (!res.ok) {
      alert(data.error || 'Something went wrong');
      return;
    }
    router.refresh();
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Emergency Fund Requests</h2>
        {isMember && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg transition"
            style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}
          >
            {showForm ? 'Cancel' : 'Request Funds'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleRequest} className="rounded-xl p-5 mb-4 border space-y-3" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Amount (₦)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required
              max={poolTotal}
              className="w-full px-4 py-2.5 rounded-lg border outline-none transition" style={inputStyle} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Pool available: {formatNaira(poolTotal)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={2}
              placeholder="What's the emergency?"
              className="w-full px-4 py-2.5 rounded-lg border outline-none transition" style={inputStyle} />
          </div>
          {error && (
            <div className="text-sm p-3 rounded-lg border" style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const myVote = r.votes?.find((v) => v.voter_id === userId);
            const approveCount = r.votes?.filter((v) => v.approve).length || 0;
            const denyCount = r.votes?.filter((v) => !v.approve).length || 0;
            return (
              <div key={r.id} className="rounded-xl p-4 border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {r.profiles?.full_name || 'Member'} — {formatNaira(Number(r.amount))}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{r.reason}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                    style={{
                      background: r.status === 'disbursed' ? "var(--accent-subtle)" : r.status === 'denied' ? "rgba(255,77,109,0.1)" : "rgba(245,184,0,0.12)",
                      color: r.status === 'disbursed' ? "var(--accent)" : r.status === 'denied' ? "var(--danger)" : "var(--color-brand-gold)",
                    }}>
                    {r.status}
                  </span>
                </div>

                {r.status === 'pending' && isMember && r.requester_id !== userId && (
                  <div className="mt-3 flex items-center gap-2">
                    {myVote ? (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        You voted to {myVote.approve ? 'approve' : 'deny'} ({approveCount} approve, {denyCount} deny)
                      </p>
                    ) : (
                      <>
                        <button onClick={() => handleVote(r.id, true)} disabled={votingId === r.id}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                          Approve
                        </button>
                        <button onClick={() => handleVote(r.id, false)} disabled={votingId === r.id}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)" }}>
                          Deny
                        </button>
                        <p className="text-xs" style={{ color: "var(--text-faint)" }}>{approveCount} approve, {denyCount} deny</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
