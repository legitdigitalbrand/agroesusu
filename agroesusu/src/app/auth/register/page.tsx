'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { AuthShell } from '@/components/ui/auth-shell';
import { AuthInput } from '@/components/ui/auth-input';
import { AuthButton } from '@/components/ui/auth-button';
import { PasswordStrength, getPasswordScore } from '@/components/ui/password-strength';
import { EyeIcon, EyeOffIcon, AlertTriangleIcon, ShieldCheckIcon, InfoIcon, CheckIcon } from '@/components/icons';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPhoneHint, setShowPhoneHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const supabase = createClient();

  const passwordScore = getPasswordScore(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const confirmError = confirmPassword.length > 0 && !passwordsMatch ? "Passwords don't match" : undefined;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passwordScore < 2) {
      setError('Please choose a stronger password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, email, full_name: fullName, phone });
      router.push(redirectTo);
      router.refresh();
    }
  };

  const loginHref = searchParams.get('redirect')
    ? `/auth/login?redirect=${encodeURIComponent(searchParams.get('redirect')!)}`
    : '/auth/login';

  return (
    <AuthShell
      eyebrow="Get started"
      heading="Create your savings account"
      subtext="Takes less than a minute. No card required to start."
      wide
    >
      <form onSubmit={handleRegister} className="space-y-4" noValidate>
        <AuthInput
          label="Full name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          placeholder="Chinedu Okonkwo"
          required
        />

        <AuthInput
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />

        <div className="relative">
          <AuthInput
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="08012345678"
            labelExtra={
              <button
                type="button"
                onMouseEnter={() => setShowPhoneHint(true)}
                onMouseLeave={() => setShowPhoneHint(false)}
                onClick={() => setShowPhoneHint((s) => !s)}
                className="flex items-center justify-center"
                style={{ color: 'var(--text-faint)' }}
              >
                <InfoIcon className="w-3.5 h-3.5" />
              </button>
            }
          />
          {showPhoneHint && (
            <div
              className="absolute left-0 top-full mt-1.5 z-10 w-64 text-xs rounded-lg p-2.5 border shadow-soft"
              style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
            >
              We only use this to notify you about deposits and group payouts — never for marketing.
            </div>
          )}
        </div>

        <div>
          <AuthInput
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Create a password"
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="p-1 rounded-md"
                style={{ color: 'var(--text-faint)' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon className="w-4.5 h-4.5" /> : <EyeIcon className="w-4.5 h-4.5" />}
              </button>
            }
          />
          <PasswordStrength password={password} />
        </div>

        <AuthInput
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
          error={confirmError}
          rightElement={
            passwordsMatch ? <CheckIcon className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={3} /> : undefined
          }
        />

        <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded shrink-0 accent-[var(--accent)]"
          />
          <span className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            I agree to AgroEsusu&apos;s <a href="#" className="underline font-medium" style={{ color: 'var(--text-secondary)' }}>Terms of Service</a> and{' '}
            <a href="#" className="underline font-medium" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</a>.
          </span>
        </label>

        {error && (
          <div
            className="text-sm p-3 rounded-xl border flex items-start gap-2"
            style={{ background: 'rgba(220,38,38,0.06)', color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.18)' }}
          >
            <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AuthButton type="submit" loading={loading}>
          {loading ? 'Creating your account…' : 'Create Account'}
        </AuthButton>

        <div
          className="flex items-center gap-2 justify-center text-xs pt-1"
          style={{ color: 'var(--text-faint)' }}
        >
          <ShieldCheckIcon className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span>Bank-grade encryption · Your data is never sold or shared</span>
        </div>
      </form>

      <p className="text-center text-sm mt-7" style={{ color: 'var(--text-muted)' }}>
        Already saving with us?{' '}
        <Link href={loginHref} className="font-semibold" style={{ color: 'var(--accent)' }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
