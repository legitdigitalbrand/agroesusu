'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, WifiIcon } from '@/components/icons';
import { formatNaira } from '@/lib/utils';

interface VASCategory { _id: string; name: string; }
interface VASProduct { _id: string; name: string; bundleCode?: string; amount?: number; description?: string; }

export default function DataPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<VASCategory[]>([]);
  const [products, setProducts] = useState<VASProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/pay/services')
      .then(res => res.json())
      .then(data => {
        if (data.services) {
          const dataService = data.services.find((s: any) => s.identifier === 'DATA');
          if (dataService) {
            fetch(`/api/pay/services?serviceId=${dataService._id}`)
              .then(res => res.json())
              .then(catData => {
                if (catData.categories) setCategories(catData.categories);
              });
          }
        }
      })
      .catch(() => setError('Failed to load services'));
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetch(`/api/pay/services?categoryId=${selectedCategory}`)
        .then(res => res.json())
        .then(data => {
          if (data.products) setProducts(data.products);
        })
        .catch(() => {});
    }
  }, [selectedCategory]);

  const selectedProductObj = products.find(p => p._id === selectedProduct);
  const amount = selectedProductObj?.amount || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/pay/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCategoryId: selectedCategory,
          bundleCode: selectedProductObj?.bundleCode || selectedProduct,
          amount: Number(amount),
          phoneNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Purchase failed');
      } else {
        setSuccess('Data bundle purchased successfully!');
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
          <WifiIcon style={{ width: 20, height: 20, color: "var(--qa-icon-color)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Buy Data</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Browse available data bundles</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Network Provider</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button key={cat._id} type="button" onClick={() => { setSelectedCategory(cat._id); setSelectedProduct(''); }}
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

        {products.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Data Plan</label>
            <div className="space-y-2">
              {products.map((prod) => (
                <button key={prod._id} type="button" onClick={() => setSelectedProduct(prod._id)}
                  className="w-full p-3 rounded-lg border text-left transition flex items-center justify-between"
                  style={{
                    background: selectedProduct === prod._id ? "var(--accent-subtle)" : "var(--surface-card)",
                    borderColor: selectedProduct === prod._id ? "var(--accent)" : "var(--border-default)",
                  }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{prod.name}</div>
                    {prod.description && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{prod.description}</div>}
                  </div>
                  {prod.amount && <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{formatNaira(prod.amount)}</div>}
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

        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        {success && <p className="text-sm" style={{ color: "var(--success, green)" }}>{success}</p>}

        <button type="submit" disabled={loading || !phoneNumber || !selectedProduct}
          className="w-full py-3.5 rounded-xl font-semibold transition disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
          {loading ? 'Processing…' : amount ? `Buy Data · ${formatNaira(Number(amount))}` : 'Select a plan'}
        </button>
      </form>
    </div>
  );
}
