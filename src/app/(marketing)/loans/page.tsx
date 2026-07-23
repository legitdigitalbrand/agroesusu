'use client';
import { useState } from 'react';
import Link from 'next/link';
import { formatNaira } from '@/lib/format';

export default function LoansPage() {
  const [amount, setAmount] = useState(500000);
  const [tenor, setTenor] = useState(91);
  const monthlyRate = 0.0265;
  const totalRepayment = Math.ceil(amount + amount * monthlyRate * (tenor / 30));
  const monthlyRepayment = Math.ceil(totalRepayment / (tenor / 30));

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-forest-green mb-4">Farm Loans</h1>
      <p className="text-lg text-gray-600 mb-8">Instant farm financing — no collateral, no guarantor. From ₦50,000 to ₦10,000,000.</p>
      <div className="grid md:grid-cols-2 gap-4 mb-12">
        {[
          { title: 'No collateral needed', desc: 'Your BVN and farm profile are all you need to get started.' },
          { title: 'Instant decisions', desc: 'Get approved in minutes with our automated credit scoring.' },
          { title: 'Same-day disbursement', desc: 'Approved loans land in your account the same day.' },
          { title: 'Flexible terms', desc: 'Choose 3 to 12 months — repay on your schedule.' },
        ].map((f) => (
          <div key={f.title} className="p-5 bg-white rounded-xl border">
            <h3 className="font-semibold text-gray-900">{f.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Loan Calculator</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount: {formatNaira(amount)}</label>
            <input type="range" min={50000} max={10000000} step={50000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full accent-forest-green" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>₦50,000</span><span>₦10,000,000</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Repayment Period: {tenor} days ({Math.round(tenor / 30)} months)</label>
            <input type="range" min={91} max={365} step={30} value={tenor} onChange={(e) => setTenor(Number(e.target.value))} className="w-full accent-forest-green" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>3 months</span><span>12 months</span></div>
          </div>
          <div className="p-4 bg-cream rounded-lg border space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Monthly rate</span><span className="font-medium">{(monthlyRate * 100).toFixed(2)}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Monthly repayment</span><span className="font-semibold text-forest-green">{formatNaira(monthlyRepayment)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total repayment</span><span className="font-medium">{formatNaira(totalRepayment)}</span></div>
          </div>
        </div>
        <Link href="/signup" className="block mt-6 py-3 bg-forest-green text-white rounded-lg font-semibold text-center hover:bg-forest-green-dark transition">Get Started</Link>
      </div>
    </div>
  );
}
