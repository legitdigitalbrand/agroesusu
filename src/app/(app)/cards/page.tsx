import { createClient } from '@/lib/supabase/server';
import EmptyState from '@/components/app/empty-state';
import { CreditCard } from 'lucide-react';

export default async function CardsPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: cards } = await supabase.from('cards').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cards</h1>
        <button className="px-5 py-2.5 bg-forest-green text-white rounded-lg font-medium hover:bg-forest-green-dark transition">
          Get a Card
        </button>
      </div>

      <div className="bg-cream rounded-2xl p-4 text-sm text-gray-600">
        Using your Agroesusu card for transactions boosts your loan approval odds. Pay anywhere in Nigeria — online and in-store.
      </div>

      {cards && cards.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div key={card.id} className="bg-gradient-to-br from-forest-green to-forest-green-dark text-white rounded-2xl p-6">
              <div className="flex items-center justify-between mb-8">
                <CreditCard size={24} className="opacity-80" />
                <span className="text-xs font-medium uppercase opacity-80">{card.card_type}</span>
              </div>
              <p className="text-lg font-mono tracking-wider">**** **** **** {card.last4}</p>
              <div className="flex items-center justify-between mt-4 text-xs opacity-80">
                <span>Agroesusu</span>
                <span className="capitalize">{card.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-8">
          <EmptyState title="No cards yet" description="Get a virtual or physical card to pay anywhere in Nigeria" actionLabel="Get a Card" actionHref="/cards" />
        </div>
      )}
    </div>
  );
}
