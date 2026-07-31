'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Wallet Funding Page ─────────────────────────────────────
// Shows customer's Safe Haven DVA account details for bank transfer.
// Displays funding status (pending/processing/successful/failed).
// Copy-to-clipboard for account number and bank name.

interface FundingAccount {
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code: string;
}

interface FundingDetails {
  provisioned: boolean;
  account?: FundingAccount;
  wallet_id?: string;
  instructions?: string;
  message?: string;
  redirect?: string;
}

type FundingStatus = 'idle' | 'loading' | 'ready' | 'not_provisioned' | 'error';
type FundStage = 'details' | 'processing' | 'success' | 'failed';

export default function WalletDepositPage() {
  const [details, setDetails] = useState<FundingDetails | null>(null);
  const [status, setStatus] = useState<FundingStatus>('loading');
  const [stage, setStage] = useState<FundStage>('details');
  const [copied, setCopied] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [showManualFunding, setShowManualFunding] = useState(false);

  const loadFundingDetails = useCallback(async () => {
    try {
      setStatus('loading');
      const res = await fetch('/api/wallets/funding-details');
      if (!res.ok) throw new Error('Failed to load funding details');
      const data = await res.json();
      setDetails(data);
      setStatus(data.provisioned ? 'ready' : 'not_provisioned');
    } catch (err) {
      console.error('Funding details error:', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadFundingDetails();
  }, [loadFundingDetails]);

  // Poll for funding status updates (check if a credit has arrived)
  useEffect(() => {
    if (status !== 'ready') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/wallets/funding-details');
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [status]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const shareDetails = async () => {
    if (!details?.account) return;
    const text = `Fund my Agriqcap wallet:\nAccount Name: ${details.account.account_name}\nAccount Number: ${details.account.account_number}\nBank: ${details.account.bank_name}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Agriqcap Wallet Funding', text });
      } catch {
        // User cancelled share
      }
    } else {
      await copyToClipboard(text, 'share');
    }
  };

  const handleSandboxFund = async () => {
    if (!details?.wallet_id) return;
    const amount = parseFloat(manualAmount);
    if (!amount || amount <= 0) return;

    setStage('processing');
    try {
      const res = await fetch(`/api/wallets/${details.wallet_id}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, source: 'sandbox', description: 'Sandbox wallet funding' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Funding failed');
      }

      setStage('success');
    } catch (err) {
      setStage('failed');
    }
  };

  // ── Loading state ────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[15px] text-gray-500">Loading funding details…</p>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.67 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-[22px] font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-[15px] text-gray-500 mb-6">We couldn't load your funding details. Please try again.</p>
            <button onClick={loadFundingDetails} className="w-full py-3 bg-[#BBDC12] text-[#1B5E20] rounded-xl font-semibold text-[15px]">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Not provisioned ───────────────────────────────────────
  if (status === 'not_provisioned') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-[22px] font-semibold text-gray-900 mb-2">Verify your identity first</h2>
            <p className="text-[15px] text-gray-500 mb-6">{details?.message || 'You need to complete identity verification before you can fund your wallet.'}</p>
            <a href="/verification" className="inline-block w-full py-3 bg-[#BBDC12] text-[#1B5E20] rounded-xl font-semibold text-[15px]">Go to verification</a>
          </div>
        </div>
      </div>
    );
  }

  // ── Processing stage ─────────────────────────────────────
  if (stage === 'processing') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[15px] text-gray-500">Processing funding…</p>
        </div>
      </div>
    );
  }

  // ── Success stage ────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-[22px] font-semibold text-gray-900 mb-2">Wallet funded!</h2>
            <p className="text-[15px] text-gray-500 mb-6">₦{manualAmount} has been added to your wallet.</p>
            <a href="/wallet" className="inline-block w-full py-3 bg-[#BBDC12] text-[#1B5E20] rounded-xl font-semibold text-[15px]">Back to wallet</a>
          </div>
        </div>
      </div>
    );
  }

  // ── Failed stage ─────────────────────────────────────────
  if (stage === 'failed') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h2 className="text-[22px] font-semibold text-gray-900 mb-2">Funding failed</h2>
            <p className="text-[15px] text-gray-500 mb-6">Something went wrong. Please try again.</p>
            <button onClick={() => setStage('details')} className="w-full py-3 bg-[#BBDC12] text-[#1B5E20] rounded-xl font-semibold text-[15px]">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main funding details view ─────────────────────────────
  const account = details?.account;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-bold text-gray-900">Fund Wallet</h1>
            <p className="text-[15px] text-gray-500 mt-1">Transfer money to your dedicated account</p>
          </div>
          <button onClick={loadFundingDetails} className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.582m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>

        {/* Account details card */}
        {account && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="bg-[#1B5E20] px-6 py-4">
              <p className="text-[13px] text-[#BBDC12] font-medium uppercase tracking-wide">Your Funding Account</p>
              <p className="text-[18px] text-white font-semibold mt-1">{account.bank_name}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Account name */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-gray-400 uppercase tracking-wide">Account Name</p>
                  <p className="text-[16px] font-medium text-gray-900 mt-1">{account.account_name}</p>
                </div>
              </div>

              {/* Account number with copy */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[13px] text-gray-400 uppercase tracking-wide">Account Number</p>
                  <p className="text-[22px] font-bold text-gray-900 mt-1 font-mono tracking-wider">{account.account_number}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(account.account_number, 'account_number')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#BBDC12] text-[#1B5E20] font-medium text-[13px] hover:bg-[#BBDC12]/90 transition-colors"
                >
                  {copied === 'account_number' ? (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy</>
                  )}
                </button>
              </div>

              {/* Bank name with copy */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[13px] text-gray-400 uppercase tracking-wide">Bank Name</p>
                  <p className="text-[16px] font-medium text-gray-900 mt-1">{account.bank_name}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(account.bank_name, 'bank_name')}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  {copied === 'bank_name' ? (
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[#1B5E20]/5 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#1B5E20] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[14px] text-gray-600">{details?.instructions || 'Transfer money to the account above. Your wallet will be credited automatically once the transfer is confirmed.'}</p>
          </div>
        </div>

        {/* Share button */}
        {account && (
          <button
            onClick={shareDetails}
            className="w-full py-3 border border-gray-200 rounded-xl font-medium text-[15px] text-gray-700 hover:bg-gray-50 transition-colors mb-3 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share account details
          </button>
        )}

        {/* Sandbox funding (testing mode) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => setShowManualFunding(!showManualFunding)}
              className="text-[13px] text-gray-400 hover:text-gray-600"
            >
              {showManualFunding ? '− Hide' : '+ Show'} sandbox funding (testing only)
            </button>
            {showManualFunding && (
              <div className="mt-4 space-y-3">
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="Amount (₦)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[16px] focus:outline-none focus:border-[#1B5E20]"
                />
                <button
                  onClick={handleSandboxFund}
                  disabled={!manualAmount || parseFloat(manualAmount) <= 0}
                  className="w-full py-3 bg-[#1B5E20] text-white rounded-xl font-semibold text-[15px] disabled:opacity-50"
                >
                  Fund wallet (sandbox)
                </button>
                <p className="text-[12px] text-gray-400 text-center">This simulates a bank transfer for testing. Not available in production.</p>
              </div>
            )}
          </div>
        )}

        {/* Back to wallet */}
        <a href="/wallet" className="block text-center text-[15px] text-gray-500 hover:text-gray-700 mt-6">
          ← Back to wallet
        </a>
      </div>
    </div>
  );
}
