'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getSafeHavenClient } from '@/lib/safe-haven';
import EmptyState from '@/components/app/empty-state';
import { formatNaira, formatDateTime } from '@/lib/format';
import { ArrowDownLeft, ArrowUpRight, Loader2, Wallet as WalletIcon } from 'lucide-react';

export default function WalletPage() {
  const [wallet, setWallet] = useState<{ id: string; balance_cached: number; safe_haven_account_number: string; bank_name: string } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: w }, { data: txns }] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);

    setWallet(w);
    setTransactions(txns || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleFund() {
    if (!wallet || !fundAmount) return;
    setProcessing(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const amount = parseFloat(fundAmount);
      const sh = getSafeHavenClient();
      const reference = `FUND-${Date.now()}`;

      // In real mode: this would initiate a transfer into the DVA
      // In mock mode: simulate the credit
      await sh.initiateTransfer({
        amount,
        recipient_account: wallet.safe_haven_account_number,
        recipient_bank: wallet.bank_name,
        narration: 'Wallet funding',
        reference,
      });

      // Record the transaction as pending
      const { data: txn } = await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: 'fund',
        amount,
        status: 'success',
        safe_haven_reference: reference,
        counterparty: { source: 'wallet_funding' },
      }).select().single();

      // Update wallet balance
      const newBalance = (wallet.balance_cached || 0) + amount;
      await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);

      setSuccess(`Successfully funded wallet with ${formatNaira(amount)}`);
      setFundAmount('');
      setShowFundModal(false);
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fund wallet');
    }
    setProcessing(false);
  }

  async function handleWithdraw() {
    if (!wallet || !withdrawAmount) return;
    const amount = parseFloat(withdrawAmount);
    if (amount > (wallet.balance_cached || 0)) {
      setError('Insufficient balance');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sh = getSafeHavenClient();
      const reference = `WDR-${Date.now()}`;

      await sh.initiateTransfer({
        amount,
        recipient_account: wallet.safe_haven_account_number,
        recipient_bank: wallet.bank_name,
        narration: 'Wallet withdrawal',
        reference,
      });

      const newBalance = (wallet.balance_cached || 0) - amount;
      await supabase.from('wallets').update({ balance_cached: newBalance }).eq('id', wallet.id);

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: 'withdraw',
        amount,
        status: 'success',
        safe_haven_reference: reference,
        counterparty: { type: 'withdrawal' },
      });

      setSuccess(`Successfully withdrew ${formatNaira(amount)}`);
      setWithdrawAmount('');
      setShowWithdrawModal(false);
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    }
    setProcessing(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-forest-green" size={32} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-forest-green to-forest-green-dark text-white rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80 mb-1">Wallet Balance</p>
            <p className="text-3xl font-bold">{formatNaira(wallet?.balance_cached || 0)}</p>
            {wallet && <p className="text-xs opacity-70 mt-2">{wallet.safe_haven_account_number} • {wallet.bank_name}</p>}
          </div>
          <WalletIcon size={28} className="opacity-50" />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => { setShowFundModal(true); setError(null); }} className="flex-1 py-2.5 bg-white/15 rounded-lg text-sm font-medium hover:bg-white/20 transition">Fund Wallet</button>
          <button onClick={() => { setShowWithdrawModal(true); setError(null); }} className="flex-1 py-2.5 bg-white/15 rounded-lg text-sm font-medium hover:bg-white/20 transition">Withdraw</button>
        </div>
      </div>

      {/* Fund Modal */}
      {showFundModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowFundModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Fund Your Wallet</h2>
            <p className="text-sm text-gray-500 mb-3">Transfer to {wallet?.safe_haven_account_number} or use card/debit method.</p>
            <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)} placeholder="Amount (₦)" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowFundModal(false)} className="flex-1 py-2.5 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleFund} disabled={processing || !fundAmount} className="flex-1 py-2.5 bg-forest-green text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {processing && <Loader2 size={16} className="animate-spin" />}Fund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowWithdrawModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Withdraw Funds</h2>
            <p className="text-sm text-gray-500 mb-3">Available: {formatNaira(wallet?.balance_cached || 0)}</p>
            <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="Amount (₦)" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowWithdrawModal(false)} className="flex-1 py-2.5 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleWithdraw} disabled={processing || !withdrawAmount} className="flex-1 py-2.5 bg-forest-green text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {processing && <Loader2 size={16} className="animate-spin" />}Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Transaction History</h2>
        {transactions.length > 0 ? (
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
                    <p className={`font-semibold ${isCredit ? 'text-green-600' : 'text-gray-900'}`}>{isCredit ? '+' : '-'}{formatNaira(txn.amount)}</p>
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
