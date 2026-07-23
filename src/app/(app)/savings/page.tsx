import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import EmptyState from '@/components/app/empty-state';
import { formatNaira, formatDate } from '@/lib/format';
import { PiggyBank, Plus, Users } from 'lucide-react';

export default async function SavingsPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const [{ data: circles }, { data: deposits }] = await Promise.all([
    supabase.from('savings_circles').select('*, savings_circle_members(*)').eq('owner_id', session.user.id).order('created_at', { ascending: false }),
    supabase.from('fixed_deposits').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Savings</h1>
      </div>

      {/* Esusu Circles */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="text-forest-green" size={20} />
            <h2 className="font-semibold text-gray-900">Esusu Circles</h2>
          </div>
          <Link href="/savings/new" className="text-sm text-forest-green hover:underline flex items-center gap-1">
            <Plus size={16} /> New Circle
          </Link>
        </div>
        {circles && circles.length > 0 ? (
          <div className="space-y-3">
            {circles.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 rounded-lg border hover:border-forest-green transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-earth-gold/10 rounded-lg flex items-center justify-center">
                    <PiggyBank className="text-earth-gold" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.frequency} • {formatNaira(c.contribution_amount)} • {c.member_count} members</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-forest-green/10 text-forest-green capitalize">{c.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No esusu circles yet" description="Create a savings circle or start a solo target-savings plan" actionLabel="Create Circle" actionHref="/savings/new" />
        )}
      </div>

      {/* Fixed Deposits */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="text-forest-green" size={20} />
            <h2 className="font-semibold text-gray-900">Fixed Deposits</h2>
          </div>
          <Link href="/savings/new-fd" className="text-sm text-forest-green hover:underline flex items-center gap-1">
            <Plus size={16} /> New Deposit
          </Link>
        </div>
        {deposits && deposits.length > 0 ? (
          <div className="space-y-3">
            {deposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-medium text-gray-900">{formatNaira(d.principal)}</p>
                  <p className="text-xs text-gray-400">{d.rate}% per annum • {d.term_days} days • matures {formatDate(d.maturity_date)}</p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-forest-green/10 text-forest-green capitalize">{d.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No fixed deposits yet" description="Lock away funds and earn competitive interest" actionLabel="Start Deposit" actionHref="/savings/new-fd" />
        )}
      </div>
    </div>
  );
}
