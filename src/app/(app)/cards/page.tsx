'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import EmptyState from '@/components/app/empty-state';
import { CreditCard, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function CardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [cardType, setCardType] = useState<'virtual' | 'physical'>('virtual');
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setCards(data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleRequestCard() {
    setRequesting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const lastFour = Math.floor(1000 + Math.random() * 9000).toString();

      const { error: insertError } = await supabase.from('cards').insert({
        user_id: user.id,
        card_type: cardType,
        last_four: lastFour,
        status: 'active',
      });

      if (insertError) throw insertError;

      setShowRequestModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request card');
    }
    setRequesting(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-forest-green" size={32} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cards</h1>
        <button
          onClick={() => setShowRequestModal(true)}
          className="px-5 py-2.5 bg-forest-green text-white rounded-lg font-medium hover:bg-forest-green-dark transition"
        >
          Get a Card
        </button>
      </div>

      <div className="bg-cream rounded-2xl p-4 text-sm text-gray-600">
        Using your Agroesusu card for transactions boosts your loan approval odds. Pay anywhere in Nigeria — online and in-store.
      </div>

      {cards.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div key={card.id} className="bg-gradient-to-br from-forest-green to-forest-green-dark text-white rounded-2xl p-6">
              <div className="flex items-center justify-between mb-8">
                <CreditCard size={24} className="opacity-80" />
                <span className="text-xs font-medium uppercase opacity-80">{card.card_type}</span>
              </div>
              <p className="text-lg font-mono tracking-wider">**** **** **** {card.last_four}</p>
              <div className="flex items-center justify-between mt-4 text-xs opacity-80">
                <span>Agroesusu</span>
                <span className="capitalize">{card.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-8">
          <EmptyState
            title="No cards yet"
            description="Get a virtual or physical card to pay anywhere in Nigeria"
            actionLabel="Get a Card"
            actionHref="/cards"
          />
        </div>
      )}

      {/* Card Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRequestModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Request a Card</h2>
            {error && <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="space-y-3 mb-4">
              <button
                onClick={() => setCardType('virtual')}
                className={`w-full p-4 rounded-lg border text-left transition ${cardType === 'virtual' ? 'border-forest-green bg-forest-green/5' : 'border-gray-200 hover:border-forest-green'}`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className={cardType === 'virtual' ? 'text-forest-green' : 'text-gray-400'} />
                  <div>
                    <p className="font-medium text-gray-900">Virtual Card</p>
                    <p className="text-xs text-gray-500">Instant — use online immediately</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setCardType('physical')}
                className={`w-full p-4 rounded-lg border text-left transition ${cardType === 'physical' ? 'border-forest-green bg-forest-green/5' : 'border-gray-200 hover:border-forest-green'}`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className={cardType === 'physical' ? 'text-forest-green' : 'text-gray-400'} />
                  <div>
                    <p className="font-medium text-gray-900">Physical Card</p>
                    <p className="text-xs text-gray-500">Delivered to your address in 3-5 days</p>
                  </div>
                </div>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRequestModal(false)} className="flex-1 py-2.5 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleRequestCard}
                disabled={requesting}
                className="flex-1 py-2.5 bg-forest-green text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {requesting && <Loader2 size={16} className="animate-spin" />}
                Request Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
