'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon } from '@/components/icons';

interface Bank {
  name: string;
  code: string;
  slug: string;
}

export default function WithdrawForm({ accounts }: { accounts: any[]; userId: string }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const selectedAccount = accounts.find(a => a.id === accountId);
  const availableBalance = Number(selectedAccount?.current_amount || 0);

  const isSoftLockedEarly =
    selectedAccount?.lock_type === 'soft' &&
    selectedAccount?.unlock_date &&
    new Date(selectedAccount.unlock_date) > new Date();

  const isHardLocked =
    (selectedAccount?.lock_type === 'hard' || selectedAccount?.lock_type === 'until_date') &&
    selectedAccount?.unlock_date &&
    new Date(selectedAccount.unlock_date) > new Date();

  useEffect(() => {
    fetch('/api/withdraw/banks')
      .then((r) => r.json())
      .then((data) => setBanks(data.banks || []))
      .catch(() => setBanks([]));
  }, []);

  // Resolve account name whenever a full 10-digit account number + bank are set
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount < 100) {
      setError('Minimum withdrawal is ₦100');
      return;
    }
    if (withdrawAmount > availableBalance) {
      setError('Insufficient balance in this pot');
      return;
    }
    if (isHardLocked) {
      setError(`This pot is locked until ${new Date(selectedAccount.unlock_date).toLocaleDateString()}`);
      return;
    }
    if (!bankCode || accountNumber.length !== 10) {
      setError('Enter a valid 10-digit account number and select your bank');
      return;
    }
    if (!resolvedName) {
      setError('We could not verify this account. Double-check the number and bank.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/withdraw/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId,
        amount: withdrawAmount,
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: resolvedName,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push('/'), 2500);
  };

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  if (success) {
    return (
      <div className="rounded-xl p-8 text-center border" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--accent-subtle)" }}>
          <CheckIcon className="w-7 h-7" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--accent)" }}>Withdrawal Processing</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>₦{Number(amount).toLocaleString()} is on its way to {resolvedName}.</p>
        <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Withdraw From</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border outline-none transition"
          style={inputStyle}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — ₦{Number(a.current_amount).toLocaleString()}
            </option>
          ))}
        </select>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Available: ₦{availableBalance.toLocaleString()}
        </p>
      </div>

      {isHardLocked && (
        <div className="text-sm p-3 rounded-lg border" style={{ background: "rgba(245,184,0,0.1)", color: "var(--color-brand-gold)", borderColor: "rgba(245,184,0,0.2)" }}>
          This pot is locked until {new Date(selectedAccount.unlock_date).toLocaleDateString()}. You can&apos;t withdraw until then.
        </div>
      )}

      {isSoftLockedEarly && (
        <div className="text-sm p-3 rounded-lg border" style={{ background: "rgba(245,184,0,0.1)", color: "var(--color-brand-gold)", borderColor: "rgba(245,184,0,0.2)" }}>
          Withdrawing before {new Date(selectedAccount.unlock_date).toLocaleDateString()} forfeits your accrued interest on this pot.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full px-4 py-3 rounded-lg border outline-none transition"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Bank</label>
        <select
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border outline-none transition"
          style={inputStyle}
        >
          <option value="">Select your bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Account Number</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
          placeholder="0123456789"
          className="w-full px-4 py-3 rounded-lg border outline-none transition"
          style={inputStyle}
        />
        {resolving && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Verifying account...</p>}
        {resolvedName && (
          <p className="text-xs mt-1 font-medium" style={{ color: "var(--accent)" }}>✓ {resolvedName}</p>
        )}
        {resolveError && (
          <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{resolveError}</p>
        )}
      </div>

      {error && (
        <div
          className="text-sm p-3 rounded-lg border"
          style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || isHardLocked || !resolvedName}
        className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}
      >
        {loading ? 'Processing...' : 'Withdraw'}
      </button>
    </form>
  );
}
