'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface-base)" }}>
      <div
        className="rounded-2xl p-8 w-full max-w-md shadow-soft border"
        style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <span className="font-bold text-base" style={{ color: "var(--qa-primary-text)" }}>A</span>
            </div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>AgroEsusu</h1>
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Save smart. Save together.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border outline-none transition"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border outline-none transition"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="text-sm p-3 rounded-lg border"
              style={{ background: "rgba(255,77,109,0.1)", color: "var(--danger)", borderColor: "rgba(255,77,109,0.2)" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--qa-primary-text)" }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
          No account?{' '}
          <Link href="/auth/register" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
