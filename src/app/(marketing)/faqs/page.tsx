'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function FaqsPage() {
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [
    { q: 'What is Agroesusu?', a: 'Agroesusu is an agricultural fintech platform that provides loans, savings, and payment services to Nigerian farmers. We operate via a licensed partner bank — Agroesusu is not a bank itself.' },
    { q: 'How do I apply for a loan?', a: 'Sign up, complete onboarding (BVN verification + farm profile), then tap "Apply for Loan" on your dashboard. You\'ll get an instant decision based on our credit scoring engine.' },
    { q: 'Do I need collateral?', a: 'No. Agroesusu loans are unsecured. We use your BVN, farm profile, transaction history, and repayment behavior to determine eligibility.' },
    { q: 'How much can I borrow?', a: 'Loan amounts range from ₦50,000 to ₦10,000,000 on web. Your pre-qualified amount depends on your credit score and profile.' },
    { q: 'How long does disbursement take?', a: 'Approved loans are disbursed to your Agroesusu account instantly or same-day.' },
    { q: 'What are the repayment terms?', a: 'Choose from 91 days (3 months) to 365 days (12 months). Monthly rates range from 2.12% to 2.65%. Full repayment terms are shown before you commit.' },
    { q: 'What is an esusu circle?', a: 'An esusu circle is a traditional rotating savings group. Members contribute regularly, and each member takes turns receiving the total pool. Agroesusu digitizes this — you can create circles, track contributions, and manage payouts in the app.' },
    { q: 'Is my money safe?', a: 'Yes. Agroesusu operates via a licensed partner bank. Deposits are insured. All transactions are encrypted and PIN-protected.' },
    { q: 'What do I need to sign up?', a: 'You need a valid BVN, phone number, and email. During onboarding we\'ll verify your BVN, capture a selfie for KYC, and create your dedicated virtual account.' },
    { q: 'Can I use Agroesusu without a smartphone?', a: 'Yes — Agroesusu works on the web. You can access all features from any browser, no app download required.' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-forest-green mb-4">FAQs</h1>
      <p className="text-lg text-gray-600 mb-8">Everything you need to know about Agroesusu.</p>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white rounded-xl border overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left p-4 flex items-center justify-between">
              <span className="font-medium text-gray-900 text-sm">{faq.q}</span>
              <span className="text-gray-400 flex-shrink-0 ml-4">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-gray-600">{faq.a}</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <p className="text-gray-500 mb-3">Still have questions?</p>
        <Link href="/contact" className="inline-block px-6 py-3 bg-forest-green text-white rounded-full font-semibold hover:bg-forest-green-dark transition">Contact Us</Link>
      </div>
    </div>
  );
}
