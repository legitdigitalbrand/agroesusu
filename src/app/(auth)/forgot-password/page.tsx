"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/yield";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen bg-indigo flex flex-col items-center justify-center px-6 py-10">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <LogoMark size={28} variant="admin" />
        <span className="font-display font-medium text-[17px] tracking-wide text-white/90">
          Agriqcap
        </span>
      </div>

      {/* Headline */}
      <div className="text-center mb-5">
        <h1 className="font-display font-bold text-[26px] leading-tight text-white mb-2">
          {sent ? "Check your email" : "Forgot password?"}
        </h1>
        <p className="text-[13px] text-white/70 max-w-[280px] mx-auto">
          {sent
            ? `We've sent a reset link to ${email}`
            : "Enter your email and we'll send you a reset link"}
        </p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-[340px] bg-paper rounded-[20px] p-6">
        {sent ? (
          <Link
            href="/login"
            className="block w-full bg-ochre text-ink font-medium text-[15px] py-3.5 rounded-[14px] text-center hover:bg-ochre-light transition"
          >
            Back to login
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="ys-label block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="ys-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ochre text-ink font-medium text-[15px] py-3.5 rounded-[14px] hover:bg-ochre-light transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Send reset link"}
            </button>
          </form>
        )}
      </div>

      {/* Back link */}
      <p className="text-[14px] text-white/70 mt-5 text-center">
        Remember your password?{" "}
        <Link href="/login" className="text-ochre font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
