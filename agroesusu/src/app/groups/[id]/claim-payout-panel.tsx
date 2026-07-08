'use client';

import { useState, useEffect } from 'react';
import { formatNaira } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Bank {
  name: string;
  code: string;
  slug: string;
}

export default function ClaimPayoutPanel({ groupId, payoutAmount }: { groupId: string; payoutAmount: number }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/withdraw/banks')
      .then((r) => r.json())
      .then((data) => setBanks(data.banks || []))
      .catch(() => setBanks([]));
  }, []);

  useEffect(() => {
    setResolvedName('');
    setResolveError('');
    if (accountNumber.length === 10 && bankCode) {
      setResolving(true);
      fetch('/api/withdraw/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.account_name) setResolvedName(data.account_name);
          else setResolveError(data.error || 'Could not verify account');
        })
        .catch(() => setResolveError('Could not verify account'))
        .finally(() => setResolving(false));
    }
  }, [accountNumber, bankCode]);

  const handleClaim = async () => {
    setError('');
    if (!bankCode || accountNumber.length !== 10 || !resolvedName) {
      setError('Select your bank and enter a valid account number');
      return;
    }
    setLoading(true);

    const res = await fetch('/api/groups/payout/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, bank_code: bankCode, account_number: accountNumber, account_name: resolvedName }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.refresh(), 2500);
  };

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  if (success) {
    return (
      <div className="rounded-xl p-6 text-center border" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Payout processing — {formatNaira(payoutAmount)} is on its way to {resolvedName}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 border" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>🎉 Your payout is ready!</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{formatNaira(payoutAmount)} — everyone has contributed this cycle</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold transition"
            style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}>
            Claim Payout
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4 space-y-3">
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle}>
            <option value="">Select your bank</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>

          <input type="text" inputMode="numeric" maxLength={10} value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="Account number"
            className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle} />

          {resolving && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Verifying account...</p>}
          {resolvedName && <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>✓ {resolvedName}</p>}
          {resolveError && <p className="text-xs" style={{ color: "var(--danger)" }}>{resolveError}</p>}

          {error && (
            <div className="text-sm p-3 rounded-lg border" style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
              {error}
            </div>
          )}

          <button onClick={handleClaim} disabled={loading || !resolvedName}
            className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}>
            {loading ? 'Processing...' : `Send ${formatNaira(payoutAmount)} to my bank`}
          </button>
        </div>
      )}
    </div>
  );
}
