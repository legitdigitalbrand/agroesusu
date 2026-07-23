'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSafeHavenClient } from '@/lib/safe-haven';
import { calculateCreditScore } from '@/lib/credit-scoring/engine';
import { Loader2, ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/format';

const steps = ['Loan Details', 'Farm Info', 'Review', 'Decision'];

export default function ApplyLoanPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Loan details
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState(100000);
  const [tenor, setTenor] = useState(91);
  const monthlyRate = 0.0265;

  // Decision result
  const [decision, setDecision] = useState<{ status: string; amount: number; score: number } | null>(null);

  const monthlyRepayment = (amount * monthlyRate * (tenor / 30) + amount / (tenor / 30)) ;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch profile and scoring inputs
      const [{ data: profile }, { count: txnCount }, { data: priorLoans }, { data: wallet }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('wallet_transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('loans').select('*').eq('user_id', user.id),
        supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      ]);

      const priorRepaid = (priorLoans || []).filter((l: { status: string }) => l.status === 'closed').length;
      const activeLoans = (priorLoans || []).filter((l: { status: string }) => l.status === 'disbursed' || l.status === 'repaying').length;
      const accountAgeDays = profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Run credit scoring
      const result = calculateCreditScore({
        bvnVerified: profile?.bvn_verified || false,
        kycTier: profile?.kyc_tier || 'tier_0',
        farmType: profile?.farm_type,
        monthlyIncome: profile?.monthly_income_estimate,
        yearsFarming: profile?.years_farming,
        dvaTransactionCount: txnCount || 0,
        priorLoansCount: (priorLoans || []).length,
        priorLoansRepaidOnTime: priorRepaid,
        existingActiveLoans: activeLoans,
        walletBalance: wallet?.balance_cached || 0,
        accountAgeDays,
      });

      // Log scoring run
      await supabase.from('credit_scoring_runs').insert({
        user_id: user.id,
        score: result.score,
        inputs_json: { profile, txnCount, priorLoans: priorLoans?.length },
        decision: result.decision,
      });

      // Create loan
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .insert({
          user_id: user.id,
          purpose,
          amount_requested: amount,
          tenor_days: tenor,
          monthly_rate: monthlyRate,
          status: result.decision === 'auto_approved' ? 'auto_approved' : result.decision,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // Log loan event
      await supabase.from('loan_events').insert({
        loan_id: loan.id,
        event_type: 'application_submitted',
        payload_json: { amount, tenor, purpose },
      });

      await supabase.from('loan_events').insert({
        loan_id: loan.id,
        event_type: 'credit_scored',
        payload_json: { score: result.score, decision: result.decision, factors: result.factors },
      });

      setDecision({
        status: result.decision,
        amount: result.decision === 'auto_approved' ? amount : result.preQualifiedAmount,
        score: result.score,
      });
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
              i < currentStep ? 'bg-forest-green text-white' :
              i === currentStep ? 'bg-forest-green text-white ring-4 ring-forest-green/20' :
              'bg-gray-200 text-gray-400'
            )}>
              {i < currentStep ? <Check size={14} /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={cn('w-12 h-0.5 mx-1', i < currentStep ? 'bg-forest-green' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-6">
        {currentStep === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">How much do you need?</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none">
                <option value="">Select purpose...</option>
                <option value="Seeds & inputs">Seeds & inputs</option>
                <option value="Equipment purchase">Equipment purchase</option>
                <option value="Livestock purchase">Livestock purchase</option>
                <option value="Irrigation setup">Irrigation setup</option>
                <option value="Harvest & processing">Harvest & processing</option>
                <option value="Farm expansion">Farm expansion</option>
                <option value="Working capital">Working capital</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount: {formatNaira(amount)}</label>
              <input type="range" min={50000} max={10000000} step={50000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full accent-forest-green" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>₦50,000</span><span>₦10,000,000</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period: {tenor} days</label>
              <input type="range" min={91} max={365} step={30} value={tenor} onChange={(e) => setTenor(Number(e.target.value))} className="w-full accent-forest-green" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>3 months</span><span>12 months</span>
              </div>
            </div>
            <div className="p-4 bg-cream rounded-lg border">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Monthly rate</span>
                <span className="font-medium">{(monthlyRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">Estimated monthly repayment</span>
                <span className="font-semibold text-forest-green">{formatNaira(Math.ceil((amount + amount * monthlyRate * (tenor / 30)) / (tenor / 30)))}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">Total repayment</span>
                <span className="font-medium">{formatNaira(Math.ceil(amount + amount * monthlyRate * (tenor / 30)))}</span>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={() => setCurrentStep(1)} disabled={!purpose} className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50">
              Continue
            </button>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Farm & business details</h2>
            <div className="p-4 bg-cream rounded-lg border text-sm text-gray-600">
              Your farm profile from onboarding will be used for this application. Please ensure it's up to date in your Profile settings.
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">This information was captured during onboarding and includes:</span></p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                <li>Farm type and location</li>
                <li>Farm size and years of experience</li>
                <li>Primary produce</li>
                <li>Estimated monthly income</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(0)} className="px-4 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1">
                <ChevronLeft size={18} /> Back
              </button>
              <button onClick={() => setCurrentStep(2)} className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition">
                Continue
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Review your application</h2>
            <div className="space-y-3 p-4 bg-cream rounded-lg border">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Purpose</span><span className="font-medium">{purpose}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-medium">{formatNaira(amount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Tenor</span><span className="font-medium">{tenor} days</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Monthly rate</span><span className="font-medium">{(monthlyRate * 100).toFixed(2)}%</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total repayment</span><span className="font-medium">{formatNaira(Math.ceil(amount + amount * monthlyRate * (tenor / 30)))}</span></div>
            </div>
            <div className="text-xs text-gray-500 p-4 bg-gray-50 rounded-lg">
              By submitting, you authorize Agroesusu to perform a credit check and verify your information. Agroesusu operates via a licensed partner bank — your loan, if approved, will be disbursed to your Agroesusu account.
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(1)} className="px-4 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1">
                <ChevronLeft size={18} /> Back
              </button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? 'Processing...' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && decision && (
          <div className="text-center py-8">
            {decision.status === 'auto_approved' ? (
              <>
                <div className="w-20 h-20 bg-forest-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={40} className="text-forest-green" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Approved! 🎉</h2>
                <p className="text-gray-500 mb-1">Your loan of <span className="font-semibold text-forest-green">{formatNaira(decision.amount)}</span> has been approved.</p>
                <p className="text-sm text-gray-400 mb-6">Funds will be disbursed to your Agroesusu account shortly.</p>
                <button onClick={() => router.push('/loans')} className="px-6 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition">
                  View My Loans
                </button>
              </>
            ) : decision.status === 'auto_declined' ? (
              <>
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Not approved</h2>
                <p className="text-gray-500 mb-1">We're unable to approve this loan at this time.</p>
                <p className="text-sm text-gray-400 mb-6">Credit score: {decision.score}. Build your transaction history and try again later.</p>
                <button onClick={() => router.push('/dashboard')} className="px-6 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition">
                  Back to Dashboard
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 size={40} className="text-yellow-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Under review</h2>
                <p className="text-gray-500 mb-1">Your application needs manual review.</p>
                <p className="text-sm text-gray-400 mb-6">Our team will review and respond within 24 hours.</p>
                <button onClick={() => router.push('/loans')} className="px-6 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition">
                  View My Loans
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
