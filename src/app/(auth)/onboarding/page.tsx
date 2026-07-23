'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSafeHavenClient } from '@/lib/safe-haven';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = ['BVN', 'Profile', 'KYC', 'Wallet', 'PIN'];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const router = useRouter();

  // BVN step state
  const [bvn, setBvn] = useState('');
  const [bvnData, setBvnData] = useState<{ first_name: string; last_name: string; dob: string; gender: string; phone: string } | null>(null);

  // Profile step state
  const [fullName, setFullName] = useState('');
  const [farmType, setFarmType] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [yearsFarming, setYearsFarming] = useState('');
  const [primaryProduce, setPrimaryProduce] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');

  // KYC step state
  const [selfieTaken, setSelfieTaken] = useState(false);

  // Wallet step state
  const [walletCreated, setWalletCreated] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ account_number: string; account_name: string; bank_name: string } | null>(null);

  // PIN step state
  const [pin, setPin] = useState('');

  // Verify session exists on mount — if not, show a warning so the user
  // knows before reaching the final step.
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled && !session) {
          setSessionWarning(true);
        }
      } catch {
        // Ignore — the handleComplete will catch it too
      }
    }
    checkSession();
    return () => { cancelled = true; };
  }, []);

  async function handleBvnVerify() {
    setLoading(true);
    setError(null);
    try {
      const sh = getSafeHavenClient();
      const result = await sh.verifyBvn(bvn);
      setBvnData({
        first_name: result.first_name,
        last_name: result.last_name,
        dob: result.dob,
        gender: result.gender,
        phone: result.phone,
      });
      setFullName(`${result.first_name} ${result.last_name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BVN verification failed. Please try again.');
    }
    setLoading(false);
  }

  async function handleCreateWallet() {
    setLoading(true);
    setError(null);
    try {
      const sh = getSafeHavenClient();
      const result = await sh.createDVA({
        account_name: fullName,
        bvn: bvn,
        email: '',
        phone: bvnData?.phone || '',
      });
      setWalletInfo({
        account_number: result.account_number,
        account_name: result.account_name,
        bank_name: result.bank_name,
      });
      setWalletCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet. Please try again.');
    }
    setLoading(false);
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Try getUser() first (network-validated), then fall back to
      // getSession() (reads from cookies locally). This handles the case
      // where the session cookie exists but the network call to validate
      // it is slow or fails.
      let userId: string;
      let userEmail: string | undefined;

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        userId = user.id;
        userEmail = user.email;
      } else {
        // Fallback: check if session exists locally in cookies
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          userId = session.user.id;
          userEmail = session.user.email;
        } else {
          // No session at all — redirect to login with a message
          router.push('/login?redirect=/onboarding');
          return;
        }
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: bvnData?.phone || '',
          email: userEmail,
          bvn_verified: true,
          kyc_tier: 'tier_2',
          farm_type: farmType,
          state,
          lga,
          farm_size: farmSize ? parseFloat(farmSize) : null,
          years_farming: yearsFarming ? parseInt(yearsFarming) : null,
          primary_produce: primaryProduce,
          monthly_income_estimate: monthlyIncome ? parseFloat(monthlyIncome) : null,
          transaction_pin: pin,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Create wallet record
      if (walletInfo) {
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({
            user_id: userId,
            safe_haven_account_number: walletInfo.account_number,
            safe_haven_account_name: walletInfo.account_name,
            bank_name: walletInfo.bank_name,
            balance_cached: 0,
          });
        if (walletError) throw walletError;
      }

      // Store KYC doc reference
      await supabase.from('kyc_documents').insert({
        user_id: userId,
        doc_type: 'selfie',
        storage_path: `kyc/${userId}/selfie`,
        status: 'approved',
      });

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Session warning */}
        {sessionWarning && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Your session may have expired. If you can&apos;t complete onboarding,{' '}
            <button onClick={() => router.push('/login?redirect=/onboarding')} className="underline font-medium">
              click here to log in again
            </button>
            .
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8 px-2">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition',
                  i < currentStep ? 'bg-forest-green text-white' :
                  i === currentStep ? 'bg-forest-green text-white ring-4 ring-forest-green/20' :
                  'bg-gray-200 text-gray-400'
                )}
              >
                {i < currentStep ? <Check size={14} /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn('w-8 h-0.5 mx-1', i < currentStep ? 'bg-forest-green' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Verify your identity</h2>
              <p className="text-sm text-gray-500">Enter your BVN to get started. We'll verify it securely.</p>
              {!bvnData ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BVN (11 digits)</label>
                    <input
                      type="text"
                      value={bvn}
                      onChange={(e) => setBvn(e.target.value)}
                      maxLength={11}
                      pattern="\d{11}"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green focus:ring-2 focus:ring-forest-green/20 outline-none"
                      placeholder="12345678901"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    onClick={handleBvnVerify}
                    disabled={loading || bvn.length !== 11}
                    className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    Verify BVN
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-forest-green/5 rounded-lg border border-forest-green/10">
                    <p className="text-sm text-gray-600 mb-1">Verified as:</p>
                    <p className="font-semibold text-gray-900">{bvnData.first_name} {bvnData.last_name}</p>
                    <p className="text-sm text-gray-500">DOB: {bvnData.dob} • {bvnData.gender}</p>
                    <p className="text-sm text-gray-500">Phone: {bvnData.phone}</p>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition"
                  >
                    Continue
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Tell us about your farm</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green focus:ring-2 focus:ring-forest-green/20 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Farm Type</label>
                  <select value={farmType} onChange={(e) => setFarmType(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none">
                    <option value="">Select...</option>
                    <option value="crop">Crop Farming</option>
                    <option value="livestock">Livestock</option>
                    <option value="mixed">Mixed (Crop + Livestock)</option>
                    <option value="agro_processing">Agro-Processing</option>
                    <option value="input_dealer">Input Dealer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Oyo" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LGA</label>
                  <input value={lga} onChange={(e) => setLga(e.target.value)} placeholder="e.g. Ibadan North" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Farm Size (acres)</label>
                  <input type="number" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} placeholder="e.g. 5" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years Farming</label>
                  <input type="number" value={yearsFarming} onChange={(e) => setYearsFarming(e.target.value)} placeholder="e.g. 3" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Produce</label>
                  <input value={primaryProduce} onChange={(e) => setPrimaryProduce(e.target.value)} placeholder="e.g. Maize, Cassava, Poultry" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income Estimate (₦)</label>
                  <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="e.g. 50000" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(0)} className="px-4 py-3 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Back</button>
                <button onClick={() => setCurrentStep(2)} disabled={!farmType || !state} className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50">
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Take a selfie</h2>
              <p className="text-sm text-gray-500">We need a photo for identity verification. Make sure your face is clearly visible and well-lit.</p>
              {!selfieTaken ? (
                <button
                  onClick={() => setSelfieTaken(true)}
                  className="w-full py-16 border-2 border-dashed border-gray-300 rounded-xl hover:border-forest-green transition flex flex-col items-center gap-2"
                >
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-500">Tap to take selfie</span>
                </button>
              ) : (
                <div className="w-full py-16 bg-forest-green/5 rounded-xl border border-forest-green/20 flex flex-col items-center gap-2">
                  <Check className="text-forest-green" size={32} />
                  <span className="text-sm font-medium text-forest-green">Selfie captured</span>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(1)} className="px-4 py-3 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Back</button>
                <button onClick={() => setCurrentStep(3)} disabled={!selfieTaken} className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50">
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Create your wallet</h2>
              <p className="text-sm text-gray-500">We'll create a dedicated virtual account for you. This is where your loans will be disbursed and your savings will be held.</p>
              {!walletCreated ? (
                <button
                  onClick={handleCreateWallet}
                  disabled={loading}
                  className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  Create Wallet
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-forest-green/5 rounded-lg border border-forest-green/10">
                    <p className="text-sm text-gray-600 mb-1">Your account:</p>
                    <p className="text-lg font-mono font-semibold text-gray-900">{walletInfo?.account_number}</p>
                    <p className="text-sm text-gray-500">{walletInfo?.account_name}</p>
                    <p className="text-sm text-gray-500">{walletInfo?.bank_name}</p>
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(2)} className="px-4 py-3 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Back</button>
                <button onClick={() => setCurrentStep(4)} disabled={!walletCreated} className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50">
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Set your transaction PIN</h2>
              <p className="text-sm text-gray-500">This 4-digit PIN will be required for all transactions. Keep it secure.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d{4}"
                  className="w-full px-4 py-3 text-2xl tracking-8 text-center rounded-lg border border-gray-200 focus:border-forest-green focus:ring-2 focus:ring-forest-green/20 outline-none"
                  placeholder="••••"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(3)} className="px-4 py-3 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Back</button>
                <button
                  onClick={handleComplete}
                  disabled={loading || pin.length !== 4}
                  className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  Complete Setup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
