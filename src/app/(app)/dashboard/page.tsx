import { createClient } from '@/lib/supabase/server';
import { Banknote, PiggyBank, Receipt, ArrowLeftRight, Sprout, Gift, Wallet as WalletIcon } from 'lucide-react';
import Link from 'next/link';
import EmptyState from '@/components/app/empty-state';
import { formatNaira, formatDate } from '@/lib/format';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const userId = session.user.id;

  const [{ data: profile }, { data: wallet }, { data: activeLoan }, { data: recentTxns }, { data: savingsCircles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('wallets').select('*').eq('user_id', userId).single(),
    supabase.from('loans').select('*').eq('user_id', userId).eq('status', 'disbursed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('wallet_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('savings_circles').select('*, savings_circle_members(*)').eq('owner_id', userId).limit(3),
  ]);

  const balance = wallet?.balance_cached || 0;
  const preQualified = profile?.pre_qualified_amount || 0;
  const quickActions = [
    { href: '/loans/apply', label: 'Apply for Loan', icon: Banknote },
    { href: '/savings', label: 'Start Saving', icon: PiggyBank },
    { href: '/pay', label: 'Pay Bills', icon: Receipt },
    { href: '/transfers', label: 'Transfer', icon: ArrowLeftRight },
    { href: '/pay', label: 'Buy Farm Inputs', icon: Sprout },
    { href: '/referrals', label: 'Refer & Earn', icon: Gift },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-forest-green to-forest-green-dark text-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80 mb-1">Wallet Balance</p>
            <p className="text-3xl font-bold">{formatNaira(balance)}</p>
            {wallet && <p className="text-xs opacity-70 mt-1">{wallet.safe_haven_account_number} • {wallet.bank_name}</p>}
          </div>
          <WalletIcon size={28} className="opacity-50" />
        </div>
        <div className="flex gap-3 mt-4">
          <Link href="/wallet" className="flex-1 py-2.5 bg-white/15 rounded-lg text-center text-sm font-medium hover:bg-white/20 transition">
            Fund Wallet
          </Link>
          <Link href="/wallet" className="flex-1 py-2.5 bg-white/15 rounded-lg text-center text-sm font-medium hover:bg-white/20 transition">
            Withdraw
          </Link>
        </div>
      </div>

      {/* Loan Status or Pre-qualified CTA */}
      {activeLoan ? (
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Active Loan</h3>
            <Link href={`/loans/${activeLoan.id}`} className="text-sm text-forest-green hover:underline">View →</Link>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNaira(activeLoan.amount_approved || activeLoan.amount_requested)}</p>
          <p className="text-sm text-gray-500">Outstanding balance</p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-forest-green rounded-full" style={{ width: '45%' }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">Next repayment: {formatDate(new Date(Date.now() + 7).toISOString())}</p>
        </div>
      ) : (
        <Link href="/loans/apply" className="block bg-white rounded-2xl border p-6 hover:border-forest-green transition group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Apply for a farm loan</h3>
              {preQualified > 0 ? (
                <p className="text-sm text-forest-green mt-1">You're pre-qualified for up to {formatNaira(preQualified)}</p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Get instant farm financing — no collateral needed</p>
              )}
            </div>
            <div className="w-12 h-12 bg-forest-green/10 rounded-xl flex items-center justify-center group-hover:bg-forest-green/20 transition">
              <Banknote className="text-forest-green" size={24} />
            </div>
          </div>
        </Link>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {quickActions.map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border hover:border-forest-green hover:shadow-sm transition group">
            <div className="w-12 h-12 bg-forest-green/10 rounded-xl flex items-center justify-center group-hover:bg-forest-green/20 transition">
              <Icon className="text-forest-green" size={22} />
            </div>
            <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
          </Link>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
          <Link href="/wallet" className="text-sm text-forest-green hover:underline">See all →</Link>
        </div>
        {recentTxns && recentTxns.length > 0 ? (
          <div className="space-y-3">
            {recentTxns.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-500 uppercase">{txn.type.slice(0, 3)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{txn.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400">{formatDate(txn.created_at)}</p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900">{formatNaira(txn.amount)}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No transactions yet"
            description="Fund your wallet to get started"
            actionLabel="Fund Wallet"
            actionHref="/wallet"
          />
        )}
      </div>

      {/* Savings Summary */}
      {savingsCircles && savingsCircles.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Your Savings Circles</h3>
            <Link href="/savings" className="text-sm text-forest-green hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {savingsCircles.map((circle) => (
              <Link key={circle.id} href="/savings" className="flex items-center justify-between p-3 rounded-lg hover:bg-cream transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-earth-gold/10 rounded-lg flex items-center justify-center">
                    <PiggyBank className="text-earth-gold" size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{circle.name}</p>
                    <p className="text-xs text-gray-400">{circle.frequency} • {formatNaira(circle.contribution_amount)}</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-forest-green/10 text-forest-green capitalize">{circle.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
