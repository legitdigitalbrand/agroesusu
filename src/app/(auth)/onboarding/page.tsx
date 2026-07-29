'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Check, 
  Loader2, 
  ShieldCheck, 
  User, 
  Sprout, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

// Define Step schemas
const step1Schema = z.object({
  bvn: z.string().length(11, { message: 'BVN must be exactly 11 digits' }).regex(/^\d+$/, { message: 'BVN must contain only numbers' }),
  nin: z.string().length(11, { message: 'NIN must be exactly 11 digits' }).regex(/^\d+$/, { message: 'NIN must contain only numbers' }),
});

const step2Schema = z.object({
  residential_address: z.string().min(5, { message: 'Residential address must be at least 5 characters long' }),
  state: z.string().min(1, { message: 'State is required' }),
  lga: z.string().min(1, { message: 'LGA is required' }),
  occupation: z.string().min(1, { message: 'Occupation is required' }),
});

const step3Schema = z.object({
  farm_type: z.string().min(1, { message: 'Farm/Business type is required' }),
  farm_size: z.string().optional()
    .refine(val => !val || !isNaN(Number(val)), { message: 'Farm size must be a number' }),
  years_farming: z.string().optional()
    .refine(val => !val || !isNaN(Number(val)), { message: 'Years farming must be a number' }),
  primary_produce: z.string().min(1, { message: 'Primary produce or goods is required' }),
  expected_harvest: z.string().min(1, { message: 'Expected harvest/sales frequency is required' }),
  annual_revenue: z.string().optional()
    .refine(val => !val || !isNaN(Number(val)), { message: 'Annual revenue must be a number' }),
  business_name: z.string().optional(),
  business_type: z.string().optional(),
});

const step4Schema = z.object({
  nok_name: z.string().min(3, { message: 'Next of Kin name must be at least 3 characters' }),
  nok_phone: z.string().min(10, { message: 'Next of Kin phone number must be at least 10 digits' })
    .regex(/^(?:\+234|0)[789][01]\d{8}$/, { message: 'Please enter a valid Nigerian phone number' }),
  nok_relationship: z.string().min(1, { message: 'Relationship is required' }),
});

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara'
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pin Input State
  const [pin, setPin] = useState(['', '', '', '']);
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // 1. Check Auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login?redirect=/onboarding');
      } else {
        setUser(session.user);
        
        // Pre-populate fields if user profile already exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          // If they already have a transaction pin, they finished onboarding
          if (profile.transaction_pin) {
            router.push('/dashboard');
            return;
          }

          // Pre-populate Step 1
          if (profile.bvn) {
            resetStep1({ bvn: profile.bvn, nin: profile.nin || '' });
          }
          // Pre-populate Step 2
          if (profile.residential_address) {
            resetStep2({
              residential_address: profile.residential_address,
              state: profile.state || '',
              lga: profile.lga || '',
              occupation: profile.occupation || '',
            });
          }
          // Pre-populate Step 3
          if (profile.farm_type) {
            resetStep3({
              farm_type: profile.farm_type,
              farm_size: profile.farm_size ? String(profile.farm_size) : '',
              years_farming: profile.years_farming ? String(profile.years_farming) : '',
              primary_produce: profile.primary_produce || '',
              expected_harvest: profile.expected_harvest || '',
              annual_revenue: profile.annual_revenue ? String(profile.annual_revenue) : '',
              business_name: profile.business_name || '',
              business_type: profile.business_type || '',
            });
          }
          // Pre-populate Step 4 Next of Kin
          if (profile.nok_name) {
            resetStep4({
              nok_name: profile.nok_name,
              nok_phone: profile.nok_phone || '',
              nok_relationship: profile.nok_relationship || '',
            });
          }
        }
      }
      setLoadingUser(false);
    };

    checkAuth();
  }, [router]);

  // Step 1 Form
  const { register: regStep1, handleSubmit: subStep1, formState: { errors: errStep1 }, reset: resetStep1 } = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { bvn: '', nin: '' }
  });

  // Step 2 Form
  const { register: regStep2, handleSubmit: subStep2, formState: { errors: errStep2 }, reset: resetStep2 } = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: { residential_address: '', state: '', lga: '', occupation: '' }
  });

  // Step 3 Form
  const { register: regStep3, handleSubmit: subStep3, formState: { errors: errStep3 }, reset: resetStep3 } = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      farm_type: '',
      farm_size: '',
      years_farming: '',
      primary_produce: '',
      expected_harvest: '',
      annual_revenue: '',
      business_name: '',
      business_type: '',
    }
  });

  // Step 4 Form
  const { register: regStep4, handleSubmit: subStep4, formState: { errors: errStep4 }, reset: resetStep4 } = useForm<z.infer<typeof step4Schema>>({
    resolver: zodResolver(step4Schema),
    defaultValues: { nok_name: '', nok_phone: '', nok_relationship: '' }
  });

  // PIN Input Handling
  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Focus next box
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handleNextStep = async (stepData: any) => {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    try {
      // Build clean payload depending on the step
      let payload = { ...stepData };

      if (currentStep === 1) {
        // Step 1: Upgrades them to kyc_tier tier_1 upon BVN/NIN submission
        payload.kyc_tier = 'tier_1';
      } else if (currentStep === 3) {
        // Step 3: Parse numeric fields to numbers or nulls
        payload.farm_size = stepData.farm_size ? Number(stepData.farm_size) : null;
        payload.years_farming = stepData.years_farming ? Number(stepData.years_farming) : null;
        payload.annual_revenue = stepData.annual_revenue ? Number(stepData.annual_revenue) : null;
      }

      // Save to supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Proceed to next step
      setCurrentStep(prev => prev + 1);
    } catch (err: any) {
      console.error(`Error saving Step ${currentStep} data:`, err);
      setError(err?.message || 'Failed to save your progress. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalSubmit = async (step4Values: z.infer<typeof step4Schema>) => {
    const finalPin = pin.join('');
    if (finalPin.length !== 4) {
      setError('Please set a secure 4-digit transaction PIN.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. Update Profile with Next of Kin and Transaction PIN
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          nok_name: step4Values.nok_name,
          nok_phone: step4Values.nok_phone,
          nok_relationship: step4Values.nok_relationship,
          transaction_pin: finalPin,
          kyc_tier: 'tier_1', // Fully completed initial onboarding
        })
        .eq('id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // 2. Redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('Error in final onboarding submission:', err);
      setError(err?.message || 'An error occurred during final submission.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[300px]">
        <Loader2 className="w-10 h-10 text-indigo animate-spin" />
        <p className="text-sm text-gray-500 mt-3 font-medium">Setting up your onboarding portal...</p>
      </div>
    );
  }

  const stepsList = [
    { number: 1, label: 'Identity', icon: ShieldCheck },
    { number: 2, label: 'Personal', icon: User },
    { number: 3, label: 'Farm', icon: Sprout },
    { number: 4, label: 'Security', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Step Progress Bar */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-5 left-4 right-4 h-0.5 bg-gray-100 -z-10" />
        <div 
          className="absolute top-5 left-4 h-0.5 bg-indigo transition-all duration-300 -z-10" 
          style={{ width: `${((currentStep - 1) / (stepsList.length - 1)) * 100}%` }}
        />

        <div className="flex justify-between items-center">
          {stepsList.map((step) => {
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div key={step.number} className="flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 font-bold text-sm ${
                    isCompleted 
                      ? 'bg-indigo border-indigo text-white' 
                      : isActive 
                        ? 'bg-white border-indigo text-indigo shadow-md shadow-indigo/10 scale-110' 
                        : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : step.number}
                </div>
                <span className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${
                  isActive ? 'text-indigo' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      {/* STEP 1: IDENTITY VERIFICATION */}
      {currentStep === 1 && (
        <form onSubmit={subStep1(handleNextStep)} className="space-y-4">
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-gray-900">Verify Your Identity</h3>
            <p className="text-xs text-gray-500 mt-1">
              We require BVN and NIN to verify your legal identity in compliance with Central Bank of Nigeria regulations.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Bank Verification Number (BVN)
            </label>
            <input
              type="text"
              maxLength={11}
              placeholder="11-digit BVN"
              {...regStep1('bvn')}
              className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                errStep1.bvn ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={submitting}
            />
            {errStep1.bvn && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errStep1.bvn.message}</p>
            )}
            <p className="mt-1.5 text-[11px] text-gray-400 leading-normal">
              Dial *565*0# from your registered mobile line to fetch your BVN.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              National Identification Number (NIN)
            </label>
            <input
              type="text"
              maxLength={11}
              placeholder="11-digit NIN"
              {...regStep1('nin')}
              className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                errStep1.nin ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={submitting}
            />
            {errStep1.nin && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errStep1.nin.message}</p>
            )}
            <p className="mt-1.5 text-[11px] text-gray-400 leading-normal">
              Dial *346# from your registered mobile line to fetch your NIN.
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3 mt-4 bg-indigo hover:bg-indigo-deep text-white rounded-xl shadow-md font-semibold transition flex items-center justify-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying identity...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: PERSONAL INFORMATION */}
      {currentStep === 2 && (
        <form onSubmit={subStep2(handleNextStep)} className="space-y-4">
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
            <p className="text-xs text-gray-500 mt-1">
              Please enter your residential address and details.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Residential Address
            </label>
            <textarea
              placeholder="e.g. 12, Agodi Gate, Ibadan"
              {...regStep2('residential_address')}
              className={`input-field h-20 py-2 focus:border-indigo focus:ring-indigo/20 ${
                errStep2.residential_address ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={submitting}
            />
            {errStep2.residential_address && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errStep2.residential_address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                State of Residence
              </label>
              <select
                {...regStep2('state')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 bg-white ${
                  errStep2.state ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              >
                <option value="">Select State</option>
                {NIGERIAN_STATES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {errStep2.state && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep2.state.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                LGA of Residence
              </label>
              <input
                type="text"
                placeholder="e.g. Ibadan North"
                {...regStep2('lga')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                  errStep2.lga ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              />
              {errStep2.lga && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep2.lga.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Primary Occupation
            </label>
            <select
              {...regStep2('occupation')}
              className={`input-field focus:border-indigo focus:ring-indigo/20 bg-white ${
                errStep2.occupation ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={submitting}
            >
              <option value="">Select Occupation</option>
              <option value="Crop Farmer">Crop Farmer</option>
              <option value="Livestock Farmer">Livestock Farmer</option>
              <option value="Poultry Farmer">Poultry Farmer</option>
              <option value="Fish Farmer">Fish Farmer</option>
              <option value="Mixed Farmer">Mixed Farmer</option>
              <option value="Agro-Processor">Agro-Processor</option>
              <option value="Agro-Merchant/Trader">Agro-Merchant/Trader</option>
              <option value="Cooperatives Leader">Cooperatives Leader</option>
              <option value="Other">Other</option>
            </select>
            {errStep2.occupation && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errStep2.occupation.message}</p>
            )}
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="btn-secondary w-1/3 py-3 rounded-xl flex items-center justify-center gap-2"
              disabled={submitting}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="submit"
              className="btn-primary w-2/3 py-3 bg-indigo hover:bg-indigo-deep text-white rounded-xl shadow-md font-semibold transition flex items-center justify-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: FARM & BUSINESS DETAILS */}
      {currentStep === 3 && (
        <form onSubmit={subStep3(handleNextStep)} className="space-y-4">
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-gray-900">Farm & Business Details</h3>
            <p className="text-xs text-gray-500 mt-1">
              Help us understand your agricultural business to tailor your credit and savings limits.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Farm/Agro Type
              </label>
              <select
                {...regStep3('farm_type')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 bg-white ${
                  errStep3.farm_type ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              >
                <option value="">Select Type</option>
                <option value="Crop Production">Crop Production</option>
                <option value="Livestock/Animal">Livestock/Animal</option>
                <option value="Poultry Farming">Poultry Farming</option>
                <option value="Aquaculture">Aquaculture/Fish</option>
                <option value="Mixed Farming">Mixed Farming</option>
                <option value="Agro-Processing">Agro-Processing</option>
                <option value="Agro-Trade/Merchant">Agro-Trade/Merchant</option>
                <option value="None">None (Cooperatives/Staff)</option>
              </select>
              {errStep3.farm_type && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep3.farm_type.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Farm Size (Hectares)
              </label>
              <input
                type="text"
                placeholder="e.g. 2.5 (or 0 if none)"
                {...regStep3('farm_size')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                  errStep3.farm_size ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              />
              {errStep3.farm_size && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep3.farm_size.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Years Farming
              </label>
              <input
                type="text"
                placeholder="e.g. 5"
                {...regStep3('years_farming')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                  errStep3.years_farming ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              />
              {errStep3.years_farming && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep3.years_farming.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Expected Harvest
              </label>
              <select
                {...regStep3('expected_harvest')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 bg-white ${
                  errStep3.expected_harvest ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              >
                <option value="">Select Frequency</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Bi-annually">Bi-annually</option>
                <option value="Annually">Annually</option>
                <option value="Continuous">Continuous (Trade/Sales)</option>
              </select>
              {errStep3.expected_harvest && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep3.expected_harvest.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Primary Produce
              </label>
              <input
                type="text"
                placeholder="e.g. Maize, Cassava"
                {...regStep3('primary_produce')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                  errStep3.primary_produce ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              />
              {errStep3.primary_produce && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep3.primary_produce.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Annual Revenue (₦)
              </label>
              <input
                type="text"
                placeholder="e.g. 1500000"
                {...regStep3('annual_revenue')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                  errStep3.annual_revenue ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              />
              {errStep3.annual_revenue && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep3.annual_revenue.message}</p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 my-4 pt-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Registered Business Details (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Business/Farm Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Akin Farms Ltd"
                  {...regStep3('business_name')}
                  className="input-field focus:border-indigo focus:ring-indigo/20"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Business Type
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sole Proprietor"
                  {...regStep3('business_type')}
                  className="input-field focus:border-indigo focus:ring-indigo/20"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="btn-secondary w-1/3 py-3 rounded-xl flex items-center justify-center gap-2"
              disabled={submitting}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="submit"
              className="btn-primary w-2/3 py-3 bg-indigo hover:bg-indigo-deep text-white rounded-xl shadow-md font-semibold transition flex items-center justify-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: NEXT OF KIN & SECURITY PIN */}
      {currentStep === 4 && (
        <form onSubmit={subStep4(handleFinalSubmit)} className="space-y-4">
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-gray-900">Next of Kin & Security PIN</h3>
            <p className="text-xs text-gray-500 mt-1">
              Add emergency contacts and set your 4-digit PIN for processing secure transactions.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-parchment/40 space-y-3">
            <h4 className="text-xs font-bold text-indigo uppercase tracking-wider">Next of Kin Details</h4>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Full Name of Next of Kin
              </label>
              <input
                type="text"
                placeholder="e.g. Grace Akinola"
                {...regStep4('nok_name')}
                className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                  errStep4.nok_name ? 'border-red-300 ring-red-100' : ''
                }`}
                disabled={submitting}
              />
              {errStep4.nok_name && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errStep4.nok_name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 08012345678"
                  {...regStep4('nok_phone')}
                  className={`input-field focus:border-indigo focus:ring-indigo/20 ${
                    errStep4.nok_phone ? 'border-red-300 ring-red-100' : ''
                  }`}
                  disabled={submitting}
                />
                {errStep4.nok_phone && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errStep4.nok_phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Relationship
                </label>
                <select
                  {...regStep4('nok_relationship')}
                  className={`input-field focus:border-indigo focus:ring-indigo/20 bg-white ${
                    errStep4.nok_relationship ? 'border-red-300 ring-red-100' : ''
                  }`}
                  disabled={submitting}
                >
                  <option value="">Select Relationship</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Parent">Parent</option>
                  <option value="Business Partner">Business Partner</option>
                  <option value="Other">Other</option>
                </select>
                {errStep4.nok_relationship && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errStep4.nok_relationship.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Secure Transaction PIN */}
          <div className="pt-2 space-y-3">
            <div className="text-center">
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Set 4-Digit Transaction PIN
              </label>
              <p className="text-xs text-gray-400 max-w-[280px] mx-auto leading-normal">
                You will use this PIN to authorize savings deposits, withdrawals, and loan withdrawals.
              </p>
            </div>

            <div className="flex justify-center gap-4 py-2">
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={pinRefs[idx]}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  className="w-12 h-14 text-center text-xl font-bold bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo focus:ring-4 focus:ring-indigo/10 transition outline-none"
                  disabled={submitting}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="btn-secondary w-1/3 py-3 rounded-xl flex items-center justify-center gap-2"
              disabled={submitting}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="submit"
              className="btn-primary w-2/3 py-3 bg-indigo hover:bg-indigo-deep text-white rounded-xl shadow-md font-semibold transition flex items-center justify-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  Complete Registration
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
