"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { Loader2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const isResetSuccess = searchParams.get("reset") === "success";
  const isInactivity = searchParams.get("reason") === "inactivity";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Authentication failed");
        setLoading(false);
        return;
      }

      // ── Send email OTP for 2nd factor verification ──
      // Gated by NEXT_PUBLIC_OTP_ENABLED — disabled until Resend domain is verified.
      // When disabled, login proceeds directly to dashboard after password auth.
      if (process.env.NEXT_PUBLIC_OTP_ENABLED === 'true') {
        try {
          const otpRes = await fetch("/api/auth/send-login-otp", { method: "POST" });
          if (otpRes.ok) {
            // OTP sent — redirect to verify-login page
            const params = new URLSearchParams();
            params.set("email", email);
            if (redirectPath !== "/dashboard") {
              params.set("redirect", redirectPath);
            }
            router.push(`/verify-login?${params.toString()}`);
            router.refresh();
            return;
          }
          // If OTP sending fails, log the error but proceed with login
          // (fail-open for usability — the password was already verified)
          const otpData = await otpRes.json().catch(() => ({}));
          console.error("[login] send-login-otp failed:", otpData.error || otpRes.status);
        } catch (otpErr) {
          console.error("[login] OTP send error:", otpErr);
        }
      }

      // ── Proceed to dashboard (OTP disabled or send failed) ──
      // Check if staff and bootstrap customer if needed
      let isStaff = false;
      try {
        const { data } = await supabase.rpc("is_staff");
        isStaff = !!data;
      } catch {
        // Not staff or RPC not available
      }

      if (!isStaff) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle();

        if (!customer) {
          try {
            await fetch("/api/bootstrap", { method: "POST" });
          } catch (err) {
            console.error("[login] Bootstrap error:", err);
          }
        }
      }

      // Confirm server has the session before navigating — prevents 401 race
      // where dashboard queries fire before cookies are committed.
      await fetch("/api/auth/post-login", { method: "POST" });
      router.push(isStaff ? "/dev/dashboard" : redirectPath);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Failed to fetch") || msg.includes("ERR_")) {
        setError("Unable to connect to the authentication service. Please check your internet connection and try again.");
      } else {
        setError(msg || "Sign in failed. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo showHome />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {isInactivity && (
          <div className="mb-4 rounded-lg bg-clay/5 border border-clay/20 px-4 py-3">
            <p className="text-[13px] text-clay font-medium">
              ⏱ Your session expired after 2 hours of inactivity. Please sign in again.
            </p>
          </div>
        )}

        {isResetSuccess && (
          <div className="mb-4 rounded-lg bg-loam/5 border border-loam/20 px-4 py-3">
            <p className="text-[13px] text-loam font-medium">
              ✓ Password updated successfully. Please sign in with your new password.
            </p>
          </div>
        )}

        <h1 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Welcome back.
        </h1>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          Sign in to manage your savings &amp; loans
        </p>

        <form onSubmit={handleLogin} autoComplete="off" spellCheck={false}>
          {/* Hidden inputs to prevent browser password autofill/caching */}
          <input type="password" name="password" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} tabIndex={-1} autoComplete="off" />
          <input type="text" name="email" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} tabIndex={-1} autoComplete="off" />
          <AuthInput
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email" autoCapitalize="off" spellCheck={false}
          />

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
            hint="Forgot password?"
            hintHref="/forgot-password"
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

          <PrimaryButton type="submit" loading={loading} className="w-full mt-2">
            Sign in
          </PrimaryButton>
        </form>

        <SwitchAuthLink
          text="Don't have an account?"
          linkText="Create one"
          href="/signup"
        />
      </motion.div>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-parchment) / 1)" }}>
        <Loader2 className="h-6 w-6 animate-spin text-loam" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
