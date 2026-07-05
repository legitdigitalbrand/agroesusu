'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.user) {
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          phone,
        });
      }
      router.push('/');
      router.refresh();
    }
  };

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--input-border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: "var(--surface-base)" }}>
      <div
        className="rounded-2xl p-8 w-full max-w-md shadow-soft border overflow-y-auto max-h-[95vh]"
        style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
              <span className="font-bold text-base" style={{ color: "var(--qa-primary-text)" }}>A</span>
            </div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>AgroEsusu</h1>
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Create your savings account</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle}
              placeholder="Chinedu Okonkwo" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle}
              placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle}
              placeholder="08012345678" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle}
              placeholder="At least 6 characters" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border outline-none transition" style={inputStyle}
              placeholder="••••••••" />
          </div>

          {error && (
            <div className="text-sm p-3 rounded-lg border"
              style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
