import { createClient } from '@/lib/supabase/server';
import EmptyState from '@/components/app/empty-state';
import { formatNaira, formatDate } from '@/lib/format';
import { Gift, Copy } from 'lucide-react';

const badges = [
  { name: 'First Loan', icon: '🌱', desc: 'Take your first loan' },
  { name: 'Saver', icon: '💰', desc: 'Save ₦50,000 in esusu' },
  { name: 'Influencer', icon: '🌟', desc: 'Refer 5 farmers' },
  { name: 'Big Spender', icon: '🛒', desc: 'Spend ₦100,000 on farm inputs' },
];

export default async function ReferralsPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  const { data: referrals } = await supabase.from('referrals').select('*').eq('referrer_id', session.user.id).order('created_at', { ascending: false });

  const earnedReferrals = referrals?.filter(r => r.status === 'earned' || r.status === 'paid').length || 0;
  const totalBonus = referrals?.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.bonus_amount, 0) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Referrals & Rewards</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-6">
          <p className="text-sm text-gray-500">Referrals Made</p>
          <p className="text-2xl font-bold text-forest-green mt-1">{earnedReferrals}</p>
        </div>
        <div className="bg-white rounded-2xl border p-6">
          <p className="text-sm text-gray-500">Total Bonus Earned</p>
          <p className="text-2xl font-bold text-forest-green mt-1">{formatNaira(totalBonus)}</p>
        </div>
      </div>

      {/* Referral Code */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Your Referral Code</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 p-4 bg-cream rounded-lg border-2 border-dashed border-forest-green/30 text-center">
            <p className="text-2xl font-bold text-forest-green tracking-wider">{profile?.referral_code || 'AGRO' + (session.user.id.slice(0, 6).toUpperCase())}</p>
          </div>
          <button className="p-4 bg-forest-green text-white rounded-lg hover:bg-forest-green-dark transition">
            <Copy size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-3">Share this code with other farmers. They get a signup bonus, and you earn rewards when they take their first loan.</p>
      </div>

      {/* Badges */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.map((badge) => (
            <div key={badge.name} className="text-center p-4 rounded-xl border">
              <div className="text-3xl mb-2">{badge.icon}</div>
              <p className="text-sm font-medium text-gray-900">{badge.name}</p>
              <p className="text-xs text-gray-400 mt-1">{badge.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Referral History</h2>
        {referrals && referrals.length > 0 ? (
          <div className="space-y-3">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-forest-green/10 rounded-full flex items-center justify-center">
                    <Gift size={16} className="text-forest-green" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatNaira(r.bonus_amount)}</p>
                    <p className="text-xs text-gray-400">{formatDate(r.created_at || new Date().toISOString())}</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-forest-green/10 text-forest-green capitalize">{r.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No referrals yet" description="Share your code to start earning rewards" />
        )}
      </div>
    </div>
  );
}
