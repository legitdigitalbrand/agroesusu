'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Get the redirect path from query param or default to /dashboard
  const redirectPath = searchParams?.get('redirect') || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. Sign in with password
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      // 2. Ensure session cookies are fully committed
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication failed. No active session found.');
      }

      // 3. Check if profile exists and has completed onboarding, if not maybe redirect to onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('kyc_tier, transaction_pin')
        .eq('id', session.user.id)
        .single();

      let targetUrl = redirectPath;
      // If we don't have a transaction_pin, they haven't completed onboarding steps, 
      // so redirect to /onboarding unless they are explicitly going somewhere else.
      if (profile && !profile.transaction_pin && redirectPath === '/dashboard') {
        targetUrl = '/onboarding';
      }

      router.push(targetUrl);
      router.refresh();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Welcome back
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Log in to manage your AgroEsusu account and savings
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-brand-primary hover:text-brand-primary-dark hover:underline transition"
            >
              Forgot Password?
            </Link>
          </div>
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
              Logging in...
            </>
          ) : (
            'Log In'
          )}
        </button>
      </form>

      <div className="text-center pt-2">
        <p className="text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-bold text-brand-primary hover:text-brand-primary-dark hover:underline transition"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        <p className="text-sm text-gray-500 mt-2">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
