import { createClient } from '@/lib/supabase/server';
import EmptyState from '@/components/app/empty-state';
import { formatNaira, formatDateTime } from '@/lib/format';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default async function WalletPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', session.user.id).single();
  const { data: transactions } = await supabase.from('wallet_transactions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-forest-green to-forest-green-dark text-white rounded-2xl p-6">
        <p className="text-sm opacity-80 mb-1">Wallet Balance</p>
        <p className="text-3xl font-bold">{formatNaira(wallet?.balance_cached || 0)}</p>
        {wallet && <p className="text-xs opacity-70 mt-2">{wallet.safe_haven_account_number} • {wallet.bank_name}</p>}
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-2.5 bg-white/15 rounded-lg text-sm font-medium hover:bg-white/20 transition">Fund Wallet</button>
          <button className="flex-1 py-2.5 bg-white/15 rounded-lg text-sm font-medium hover:bg-white/20 transition">Withdraw</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Transaction History</h2>
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((txn) => {
              const isCredit = txn.type === 'fund' || txn.type === 'transfer_in';
              return (
                <div key={txn.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? 'bg-green-50' : 'bg-red-50'}`}>
                      {isCredit ? <ArrowDownLeft className="text-green-600" size={18} /> : <ArrowUpRight className="text-red-500" size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{txn.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(txn.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isCredit ? 'text-green-600' : 'text-gray-900'}`}>
                      {isCredit ? '+' : '-'}{formatNaira(txn.amount)}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{txn.status}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No transactions yet" description="Fund your wallet to start transacting" actionLabel="Fund Wallet" actionHref="/wallet" />
        )}
      </div>
    </div>
  );
}
