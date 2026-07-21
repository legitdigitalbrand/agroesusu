'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PhoneIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';

interface VASService { _id: string; name: string; identifier: string; }
interface VASCategory { _id: string; name: string; }

export default function AirtimePage() {
  const router = useRouter();
  const [services, setServices] = useState<VASService[]>([]);
  const [categories, setCategories] = useState<VASCategory[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/pay/services')
      .then(res => res.json())
      .then(data => {
        if (data.services) {
          setServices(data.services);
          // Find airtime service
          const airtime = data.services.find((s: VASService) => s.identifier === 'AIRTIME');
          if (airtime) {
            setSelectedService(airtime._id);
          }
        }
      })
      .catch(() => setError('Failed to load services'));
  }, []);

  useEffect(() => {
    if (selectedService) {
      fetch(`/api/pay/services?serviceId=${selectedService}`)
        .then(res => res.json())
        .then(data => {
          if (data.categories) setCategories(data.categories);
        })
        .catch(() => {});
    }
  }, [selectedService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/pay/airtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCategoryId: selectedCategory || selectedService,
          amount: Number(amount),
          phoneNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Purchase failed');
      } else {
        setSuccess(`Airtime purchased successfully! ₦${Number(amount).toLocaleString()} sent to ${phoneNumber}.`);
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
          <PhoneIcon style={{ width: 20, height: 20, color: "var(--qa-icon-color)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Buy Airtime</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Top up any phone number instantly</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {categories.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Network Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button key={cat._id} type="button" onClick={() => setSelectedCategory(cat._id)}
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
        )}

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
          <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required
            placeholder="0801 234 5678"
            className="w-full px-4 py-3 rounded-lg border outline-none text-sm" style={inputStyle} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Amount (₦)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={50}
            placeholder="100" step={50}
            className="w-full px-4 py-3 rounded-lg border outline-none text-sm" style={inputStyle} />
          <div className="flex gap-2 mt-2 flex-wrap">
            {[100, 200, 500, 1000, 2000, 5000].map(amt => (
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

        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        {success && <p className="text-sm" style={{ color: "var(--success, green)" }}>{success}</p>}

        <button type="submit" disabled={loading || !phoneNumber || !amount}
          className="w-full py-3.5 rounded-xl font-semibold transition disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
          {loading ? 'Processing…' : `Buy Airtime${amount ? ` · ${formatNaira(Number(amount))}` : ''}`}
        </button>
      </form>
    </div>
  );
}
