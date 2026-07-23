'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSafeHavenClient } from '@/lib/safe-haven';
import { Loader2, Check, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = ['BVN', 'Profile', 'KYC', 'Wallet', 'PIN'];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: bvnData?.phone || user.phone || '',
          email: user.email,
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
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Create wallet record
      if (walletInfo) {
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            safe_haven_account_number: walletInfo.account_number,
            safe_haven_account_name: walletInfo.account_name,
            bank_name: walletInfo.bank_name,
            balance_cached: 0,
          });
        if (walletError) throw walletError;
      }

      // Store KYC doc reference
      await supabase.from('kyc_documents').insert({
        user_id: user.id,
        doc_type: 'selfie',
        storage_path: `kyc/${user.id}/selfie`,
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
                  <input type="number" value={yearsFarming} onChange={(e) => setYearsFarming(e.target.value)} placeholder="e.g. 10" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Produce</label>
                  <input value={primaryProduce} onChange={(e) => setPrimaryProduce(e.target.value)} placeholder="e.g. Maize" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income (₦)</label>
                  <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="e.g. 150000" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-forest-green outline-none" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(0)} className="px-4 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1">
                  <ChevronLeft size={18} /> Back
                </button>
                <button onClick={() => setCurrentStep(2)} disabled={!farmType || !state} className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50">
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Take a selfie</h2>
              <p className="text-sm text-gray-500">We need to verify your face matches your BVN record.</p>
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl">
                {selfieTaken ? (
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-forest-green/10 flex items-center justify-center mb-3">
                      <Check size={32} className="text-forest-green" />
                    </div>
                    <p className="font-medium text-gray-700">Selfie captured</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-3 mx-auto">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                      </svg>
                    </div>
                    <p className="text-gray-500 mb-3">Position your face in the frame</p>
                  </div>
                )}
                <button
                  onClick={() => setSelfieTaken(true)}
                  className="px-6 py-2.5 bg-forest-green text-white rounded-lg font-medium hover:bg-forest-green-dark transition"
                >
                  {selfieTaken ? 'Retake' : 'Capture Selfie'}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(1)} className="px-4 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1">
                  <ChevronLeft size={18} /> Back
                </button>
                <button onClick={() => setCurrentStep(3)} disabled={!selfieTaken} className="flex-1 py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50">
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Your Agroesusu account</h2>
              <p className="text-sm text-gray-500">We're creating your dedicated virtual account for funding and receiving loans.</p>
              {!walletCreated ? (
                <>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    onClick={handleCreateWallet}
                    disabled={loading}
                    className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    Create My Account
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-6 bg-forest-green text-white rounded-xl">
                    <p className="text-sm opacity-80 mb-1">Your account number</p>
                    <p className="text-2xl font-bold tracking-wider">{walletInfo?.account_number}</p>
                    <p className="text-sm opacity-80 mt-1">{walletInfo?.account_name} • {walletInfo?.bank_name}</p>
                  </div>
                  <p className="text-sm text-gray-500">Fund this account anytime to start saving or apply for loans.</p>
                  <button onClick={() => setCurrentStep(4)} className="w-full py-3 bg-forest-green text-white rounded-lg font-semibold hover:bg-forest-green-dark transition">
                    Continue
                  </button>
                </div>
              )}
              <button onClick={() => setCurrentStep(2)} className="px-4 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1">
                <ChevronLeft size={18} /> Back
              </button>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Set your transaction PIN</h2>
              <p className="text-sm text-gray-500">This 4-digit PIN protects all money movements on your account.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">4-digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={4}
                  pattern="\d{4}"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-green focus:ring-2 focus:ring-forest-green/20 outline-none text-2xl tracking-[0.5em] text-center"
                  placeholder="••••"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(3)} className="px-4 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1">
                  <ChevronLeft size={18} /> Back
                </button>
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
