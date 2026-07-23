'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const faqs = [
  { q: 'How do I apply for a loan?', a: 'Tap "Apply for Loan" on your dashboard, fill in the amount and purpose, and get an instant decision.' },
  { q: 'How long does disbursement take?', a: 'Approved loans are disbursed to your Agroesusu account instantly or same-day.' },
  { q: 'How do I join an esusu circle?', a: 'Go to Savings, create a circle or ask for an invite link from a circle owner.' },
  { q: 'Is my money safe?', a: 'Agroesusu operates via a licensed partner bank. Your deposits are insured.' },
  { q: 'How do I contact support?', a: 'Send a message below or email support@agroesusu.com' },
];

export default function SupportPage() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated'); return; }

      // Insert as a notification so support staff can see it
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Support ticket',
        body: message,
        read: false,
      });

      if (notifError) throw notifError;

      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Support</h1>

      {/* FAQs */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b last:border-0">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left py-3 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-700">{faq.q}</span>
                <span className="text-gray-400">{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <p className="text-sm text-gray-500 pb-3">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Form */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Send us a message</h2>
        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {sent && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            ✓ Message sent! We'll get back to you within 24 hours.
          </div>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="How can we help you?"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green focus:ring-2 focus:ring-forest-green/20 outline-none resize-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !message}
          className="mt-3 w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </div>

      <div className="text-center text-sm text-gray-400">
        Or email us at <a href="mailto:support@agroesusu.com" className="text-forest-green">support@agroesusu.com</a>
      </div>
    </div>
  );
}
