'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { AuthSplitShell } from '@/components/ui/auth-split-shell';
import { AuthInput } from '@/components/ui/auth-input';
import { AuthButton } from '@/components/ui/auth-button';
import { EyeIcon, EyeOffIcon, AlertTriangleIcon } from '@/components/icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? "That email and password don't match. Double-check and try again."
          : error.message
      );
      setLoading(false);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  };

  const registerHref = searchParams.get('redirect')
    ? `/auth/register?redirect=${encodeURIComponent(searchParams.get('redirect')!)}`
    : '/auth/register';

  return (
    <AuthSplitShell
      heading="Welcome back to AgroEsusu"
      subtext="Sign in to keep saving toward your goals."
    >
      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <AuthInput
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />

        <AuthInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-faint)' }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon className="w-4.5 h-4.5" /> : <EyeIcon className="w-4.5 h-4.5" />}
            </button>
          }
        />

        {error && (
          <div
            className="text-sm p-3 rounded-xl border flex items-start gap-2"
            style={{
              background: 'rgba(220,38,38,0.06)',
              color: 'var(--danger)',
              borderColor: 'rgba(220,38,38,0.18)',
            }}
          >
            <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AuthButton type="submit" loading={loading}>
          {loading ? 'Signing in…' : 'Continue'}
        </AuthButton>
      </form>

      <p className="text-center text-sm mt-7" style={{ color: 'var(--text-muted)' }}>
        New to AgroEsusu?{' '}
        <Link href={registerHref} className="font-semibold" style={{ color: '#F97316' }}>
          Create an account
        </Link>
      </p>
    </AuthSplitShell>
  );
}
