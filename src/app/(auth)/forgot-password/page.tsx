"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { LoginRightPanel } from "@/components/auth/RightPanel";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Failed to fetch") || msg.includes("ERR_")) {
        setError("Unable to connect to the authentication service. Please check your internet connection and try again.");
      } else {
        setError(msg || "Failed to send reset link. Please try again.");
      }
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        {sent ? (
          <>
            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Check your email
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              We sent a password reset link to <span className="font-medium text-ink">{email}</span>.
              Click the link to set a new password.
            </p>
            <SwitchAuthLink text="" linkText="← Back to sign in" href="/login" />
          </>
        ) : (
          <>
            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Forgot password?
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} autoComplete="off" spellCheck={false}>
              <AuthInput
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email" autoCapitalize="off" spellCheck={false}
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5 mb-4"
                >
                  {error}
                </motion.p>
              )}

              <PrimaryButton loading={loading} disabled={loading}>
                Send reset link
              </PrimaryButton>
            </form>

            <SwitchAuthLink text="" linkText="← Back to sign in" href="/login" />
          </>
        )}
      </motion.div>
    </AuthLayout>
  );
}
