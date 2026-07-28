'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, User, Mail, Phone, Lock, AlertCircle } from 'lucide-react';

const signupSchema = z.object({
  fullName: z.string().min(3, { message: 'Full name must be at least 3 characters long' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  phone: z.string().min(10, { message: 'Phone number must be at least 10 digits long' })
    .regex(/^(?:\+234|0)[789][01]\d{8}$/, { message: 'Please enter a valid Nigerian phone number' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. Sign up user via Supabase Auth
      const { data, error: signupError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            phone: values.phone,
          },
        },
      });

      if (signupError) {
        throw new Error(signupError.message);
      }

      if (!data.user) {
        throw new Error('Something went wrong during registration.');
      }

      // 2. Explicitly upsert profile (in case database trigger handle_new_user fails/lags)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          full_name: values.fullName,
          email: values.email,
          phone: values.phone,
          kyc_tier: 'tier_0',
          role: 'user',
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Error upserting profile, proceeding anyway:', profileError);
      }

      // 3. Call getSession to commit authentication state in cookies/session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // If email confirmation is enabled, session might be null.
        setError('Registration successful! Please check your email to confirm your account, then log in.');
        setLoading(false);
        return;
      }

      // 4. Redirect to onboarding
      router.push('/onboarding');
      router.refresh();
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err?.message || 'An unexpected error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Create your account
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Join AgroEsusu and start growing your agricultural wealth
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Full Name (First and Last Name)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="e.g. Babajide Akinola"
              {...register('fullName')}
              className={`input-field pl-10 focus:border-brand-primary focus:ring-brand-primary/20 ${
                errors.fullName ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={loading}
            />
          </div>
          {errors.fullName && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.fullName.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="email"
              placeholder="e.g. b.akinola@gmail.com"
              {...register('email')}
              className={`input-field pl-10 focus:border-brand-primary focus:ring-brand-primary/20 ${
                errors.email ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={loading}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.email.message}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Phone className="w-5 h-5" />
            </div>
            <input
              type="tel"
              placeholder="e.g. 08012345678"
              {...register('phone')}
              className={`input-field pl-10 focus:border-brand-primary focus:ring-brand-primary/20 ${
                errors.phone ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={loading}
            />
          </div>
          {errors.phone && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.phone.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              className={`input-field pl-10 pr-10 focus:border-brand-primary focus:ring-brand-primary/20 ${
                errors.password ? 'border-red-300 ring-red-100' : ''
              }`}
              disabled={loading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary w-full py-3 mt-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl shadow-md font-semibold transition flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating account...
            </>
          ) : (
            'Sign Up'
          )}
        </button>
      </form>

      <div className="text-center pt-2">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-bold text-brand-primary hover:text-brand-primary-dark hover:underline transition"
          >
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
