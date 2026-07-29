"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/yield";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Wire to Supabase auth reset password
    setTimeout(() => {
      setSent(true);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-indigo-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="flex items-center justify-center mb-8">
          <span className="font-serif text-3xl text-white">Agriqcap</span>
        </Link>

        <div className="bg-paper rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <h1 className="font-serif text-2xl text-ink">Check your email</h1>
              <p className="text-sm text-ink-soft">
                We've sent a password reset link to <span className="font-medium text-ink">{email}</span>.
                Follow the link to reset your password.
              </p>
              <Link href="/login">
                <Button className="w-full">Back to login</Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-2xl text-ink mb-1">Forgot password?</h1>
              <p className="text-sm text-ink-soft mb-6">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="ys-label">EMAIL</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-track bg-paper px-4 py-3 text-ink focus:border-indigo focus:outline-none"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>

              <p className="text-center mt-6 text-sm text-ink-soft">
                Remember your password?{" "}
                <Link href="/login" className="text-indigo font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
