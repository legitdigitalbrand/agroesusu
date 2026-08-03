"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { Loader2 } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      // a. Check URL error params from Supabase (e.g. ?error_description=... when reset link expires)
      const urlErrorDesc = searchParams.get("error_description");
      const urlError = searchParams.get("error");
      if (urlErrorDesc || urlError) {
        setSessionError(urlErrorDesc || urlError || "Invalid or expired reset link");
        setCheckingSession(false);
        return;
      }

      // b. On mount, call supabase.auth.getSession() to ensure PKCE code exchange / recovery session is established
      const supabase = createClient();
      let { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Wait briefly (500ms) for PKCE exchange or state recovery to complete
        await new Promise((resolve) => setTimeout(resolve, 500));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
      }

      if (!session) {
        setSessionError("Invalid or expired reset link");
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must include uppercase, lowercase, and a number");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // c. After successful password update, sign the user out before redirecting
    try { await supabase.auth.signOut(); } catch (err) { console.warn('[reset-password] Remote signOut failed:', err); }

    router.push("/login?reset=success");
    router.refresh();
  };

  if (checkingSession) {
    return (
      <AuthLayout rightPanel={<LoginRightPanel />}>
        <AuthLogo />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-loam" />
        </div>
      </AuthLayout>
    );
  }

  if (sessionError) {
    return (
      <AuthLayout rightPanel={<LoginRightPanel />}>
        <AuthLogo />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
            Reset link invalid
          </h2>
          <p className="text-[14px] text-ink-soft mb-6 leading-relaxed">
            This password reset link is invalid or has expired. Please request a new link.
          </p>
          <div className="bg-clay/5 text-clay text-[13px] rounded-lg p-3.5 mb-6 border border-clay/20">
            {sessionError}
          </div>
          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-[13px] text-loam font-medium hover:text-indigo transition"
            >
              Request a new password reset link →
            </Link>
          </div>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Set new password
        </h2>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} autoComplete="off" spellCheck={false}>
          <PasswordInput
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <p className="text-[11px] text-ink-soft mb-4 leading-relaxed">
            Min 8 characters with at least one uppercase, lowercase, and number.
          </p>

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
            Update password
          </PrimaryButton>
        </form>
      </motion.div>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-parchment) / 1)" }}>
          <Loader2 className="h-6 w-6 animate-spin text-loam" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
