'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, BoltIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';

interface VASCategory { _id: string; name: string; }

export default function BillsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<VASCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [vendType, setVendType] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/pay/services')
      .then(res => res.json())
      .then(data => {
        if (data.services) {
          const utilityService = data.services.find((s: any) => s.identifier === 'UTILITY');
          if (utilityService) {
            fetch(`/api/pay/services?serviceId=${utilityService._id}`)
              .then(res => res.json())
              .then(catData => {
                if (catData.categories) setCategories(catData.categories);
              });
          }
        }
      })
      .catch(() => setError('Failed to load services'));
  }, []);

  const handleVerify = async () => {
    if (!meterNumber || !selectedCategory) return;
    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/pay/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verify: true, meterNumber, serviceCategoryId: selectedCategory }),
      });
      const data = await res.json();
      if (data.valid) {
        setVerified(true);
        setVendType(data.vendType || 'PREPAID');
      } else {
        setError(data.message || 'Meter number verification failed');
      }
    } catch {
      setError('Verification failed');
    }
    setVerifying(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/pay/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCategoryId: selectedCategory,
          amount: Number(amount),
          meterNumber,
          vendType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Payment failed');
      } else {
        setSuccess('Electricity bill paid successfully!');
        setTimeout(() => router.push('/transactions'), 2000);
      }
    } catch {
      setError('Something went wrong');
    }
    setLoading(false);
  };

  const inputStyle = { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" };

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <Link href="/pay" className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        <ArrowLeftIcon className="w-4 h-4" /> Back to Pay
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--pot-icon-bg)" }}>
          <BoltIcon style={{ width: 20, height: 20, color: "var(--qa-icon-color)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Electricity</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Pay your utility bills instantly</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Disco (Distribution Company)</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button key={cat._id} type="button" onClick={() => { setSelectedCategory(cat._id); setVerified(false); }}
                className="p-3 rounded-lg border text-left text-sm font-medium transition"
                style={{
                  background: selectedCategory === cat._id ? "var(--accent-subtle)" : "var(--surface-card)",
                  borderColor: selectedCategory === cat._id ? "var(--accent)" : "var(--border-default)",
                  color: selectedCategory === cat._id ? "var(--accent)" : "var(--text-primary)",
                }}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Meter Number</label>
          <div className="flex gap-2">
            <input type="text" value={meterNumber} onChange={(e) => { setMeterNumber(e.target.value); setVerified(false); }} required
              placeholder="Enter your meter number"
              className="flex-1 px-4 py-3 rounded-lg border outline-none text-sm" style={inputStyle} />
            <button type="button" onClick={handleVerify} disabled={!meterNumber || !selectedCategory || verifying || verified}
              className="px-4 py-3 rounded-lg border text-sm font-medium transition disabled:opacity-50"
              style={{
                background: verified ? "var(--accent-subtle)" : "var(--surface-card)",
                borderColor: verified ? "var(--accent)" : "var(--border-default)",
                color: verified ? "var(--accent)" : "var(--text-secondary)",
              }}>
              {verifying ? 'Verifying…' : verified ? '✓ Verified' : 'Verify'}
            </button>
          </div>
        </div>

        {verified && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Amount (₦)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={100}
              placeholder="1000" step={100}
              className="w-full px-4 py-3 rounded-lg border outline-none text-sm" style={inputStyle} />
            <div className="flex gap-2 mt-2 flex-wrap">
              {[1000, 2000, 5000, 10000, 20000].map(amt => (
                <button key={amt} type="button" onClick={() => setAmount(amt.toString())}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition"
                  style={{
                    background: amount === amt.toString() ? "var(--accent-subtle)" : "transparent",
                    borderColor: amount === amt.toString() ? "var(--accent)" : "var(--border-default)",
                    color: amount === amt.toString() ? "var(--accent)" : "var(--text-muted)",
                  }}>
                  {formatNaira(amt)}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        {success && <p className="text-sm" style={{ color: "var(--success, green)" }}>{success}</p>}

        <button type="submit" disabled={loading || !verified || !amount}
          className="w-full py-3.5 rounded-xl font-semibold transition disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
          {loading ? 'Processing…' : amount ? `Pay · ${formatNaira(Number(amount))}` : 'Verify meter first'}
        </button>
      </form>
    </div>
  );
}
