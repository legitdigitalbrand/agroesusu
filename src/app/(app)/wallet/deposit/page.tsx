'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Copy, Check, Share2, RefreshCw, AlertCircle, Info, ArrowLeft } from "lucide-react";

// ── Wallet Funding Page ─────────────────────────────────────
// Shows customer's Safe Haven DVA account details for bank transfer.
// Uses Agriqcap design tokens (no hardcoded colors).

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
}

type FundingStatus = 'idle' | 'loading' | 'ready' | 'not_provisioned' | 'error';
type FundStage = 'details' | 'processing' | 'success' | 'failed';

const fmtNGN = (v: number) => {
  const formatted = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.abs(v || 0));
  return `${(v || 0) < 0 ? "-" : ""}₦${formatted}`;
};

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

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
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
      } catch { /* cancelled */ }
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
    } catch {
      setStage('failed');
    }
  };

  // ── Loading ──────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-soft">Loading funding details…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="bg-paper border border-line rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-clay-light flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-clay" />
          </div>
          <h2 className="font-display font-semibold text-xl text-ink mb-2">We couldn&apos;t load your funding details</h2>
          <p className="text-sm text-ink-soft mb-6">
            This might be a temporary connection issue. Please try again.
          </p>
          <button onClick={loadFundingDetails} className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-sm hover:opacity-90 transition">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Not provisioned ───────────────────────────────────────
  if (status === 'not_provisioned') {
    return (
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="bg-paper border border-line rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-loam-light flex items-center justify-center mx-auto mb-4">
            <Info className="w-6 h-6 text-loam" />
          </div>
          <h2 className="font-display font-semibold text-xl text-ink mb-2">Your funding account isn&apos;t ready yet</h2>
          <p className="text-sm text-ink-soft mb-6">
            {details?.message || 'You need to complete identity verification before you can fund your wallet.'}
          </p>
          <Link href="/profile" className="inline-block w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-sm hover:opacity-90 transition">
            Complete verification
          </Link>
        </div>
      </div>
    );
  }

  // ── Processing ────────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-soft">Processing funding…</p>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="bg-paper border border-line rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-loam-light flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-loam" />
          </div>
          <h2 className="font-display font-semibold text-xl text-ink mb-2">Wallet funded!</h2>
          <p className="text-sm text-ink-soft mb-6">{fmtNGN(parseFloat(manualAmount) || 0)} has been added to your wallet.</p>
          <Link href="/wallet" className="inline-block w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-sm hover:opacity-90 transition">
            Back to wallet
          </Link>
        </div>
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────
  if (stage === 'failed') {
    return (
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="bg-paper border border-line rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-clay-light flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-clay" />
          </div>
          <h2 className="font-display font-semibold text-xl text-ink mb-2">Funding failed</h2>
          <p className="text-sm text-ink-soft mb-6">Something went wrong with the funding. Please try again.</p>
          <button onClick={() => setStage('details')} className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-sm hover:opacity-90 transition">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Main funding details view ─────────────────────────────
  const account = details?.account;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">Fund Wallet</h1>
          <p className="text-sm text-ink-soft mt-1">Transfer money to your dedicated account</p>
        </div>
        <button onClick={loadFundingDetails} className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-parchment transition flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-ink-soft" />
        </button>
      </div>

      {/* Account details card */}
      {account && (
        <div className="bg-paper border border-line rounded-2xl overflow-hidden mb-6">
          <div className="bg-indigo px-6 py-4">
            <p className="text-[13px] text-ochre font-medium uppercase tracking-wide">Your Funding Account</p>
            <p className="text-[18px] text-white font-semibold mt-1">{account.bank_name}</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Account name */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-soft uppercase tracking-wide">Account Name</p>
                <p className="text-[16px] font-medium text-ink mt-1">{account.account_name}</p>
              </div>
            </div>

            {/* Account number with copy */}
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <div>
                <p className="text-xs text-ink-soft uppercase tracking-wide">Account Number</p>
                <p className="font-mono text-2xl font-bold text-ink mt-1 tracking-wider">{account.account_number}</p>
              </div>
              <button
                onClick={() => copyToClipboard(account.account_number, 'account_number')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ochre text-indigo-deep font-medium text-[13px] hover:opacity-90 transition"
              >
                {copied === 'account_number' ? (
                  <><Check className="w-4 h-4" /> Copied</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copy</>
                )}
              </button>
            </div>

            {/* Bank name with copy */}
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <div>
                <p className="text-xs text-ink-soft uppercase tracking-wide">Bank Name</p>
                <p className="text-[16px] font-medium text-ink mt-1">{account.bank_name}</p>
              </div>
              <button
                onClick={() => copyToClipboard(account.bank_name, 'bank_name')}
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-parchment transition flex items-center justify-center"
              >
                {copied === 'bank_name' ? (
                  <Check className="w-5 h-5 text-loam" />
                ) : (
                  <Copy className="w-5 h-5 text-ink-soft" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-loam-light rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-loam mt-0.5 flex-shrink-0" />
          <p className="text-[14px] text-ink">{details?.instructions || 'Transfer money to the account above. Your wallet will be credited automatically once the transfer is confirmed.'}</p>
        </div>
      </div>

      {/* Share button */}
      {account && (
        <button
          onClick={shareDetails}
          className="w-full py-3 min-h-[44px] border border-line rounded-xl font-medium text-sm text-ink hover:bg-parchment transition flex items-center justify-center gap-2"
        >
          <Share2 className="w-5 h-5 text-ink-soft" />
          Share account details
        </button>
      )}

      {/* Sandbox funding (testing mode) */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-6 pt-6 border-t border-line">
          <button
            onClick={() => setShowManualFunding(!showManualFunding)}
            className="text-xs text-ink-soft hover:text-ink"
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
                className="w-full px-4 py-3 border border-line rounded-xl text-[16px] bg-paper text-ink focus:outline-none focus:border-indigo"
              />
              <button
                onClick={handleSandboxFund}
                disabled={!manualAmount || parseFloat(manualAmount) <= 0}
                className="w-full py-3 bg-indigo text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition"
              >
                Fund wallet (sandbox)
              </button>
              <p className="text-[12px] text-ink-soft text-center">This simulates a bank transfer for testing. Not available in production.</p>
            </div>
          )}
        </div>
      )}

      {/* Back to wallet */}
      <Link href="/wallet" className="flex items-center justify-center gap-1 text-sm text-ink-soft hover:text-ink mt-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back to wallet
      </Link>
    </div>
  );
}
