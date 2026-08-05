"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { OtpInput } from "@/components/auth/OtpInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { OTP_RESEND_COOLDOWN_SEC } from "@/lib/auth/device";

function VerifyLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(OTP_RESEND_COOLDOWN_SEC);
  const [resending, setResending] = useState(false);
  const mountedRef = useRef(true);

  // Mask email for display: j***@example.com
  const maskedEmail = (() => {
    if (!email) return "your email";
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const maskedLocal = local.length <= 2 ? local[0] + "*" : local.slice(0, 2) + "*".repeat(Math.min(local.length - 2, 4));
    return `${maskedLocal}@${domain}`;
  })();

  // Resend cooldown timer
  useEffect(() => {
    mountedRef.current = true;
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        if (mountedRef.current) setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    return () => { mountedRef.current = false; };
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
        setLoading(false);
        return;
      }

      // OTP verified — redirect to dashboard
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Failed to fetch") || msg.includes("ERR_")) {
        setError("Unable to connect. Please check your internet connection.");
      } else {
        setError(msg || "Verification failed. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/send-login-otp", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to resend code. Please try again.");
      } else {
        setOtp("");
        setResendCooldown(OTP_RESEND_COOLDOWN_SEC);
      }
    } catch (err) {
      setError("Unable to resend code. Please check your connection.");
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
    router.refresh();
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-14 h-14 rounded-2xl bg-loam/10 flex items-center justify-center mb-6">
          <ShieldCheck className="w-7 h-7 text-loam" />
        </div>

        <h1 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Verify it's you
        </h1>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-ink">{maskedEmail}</span>.
          Enter it below to complete sign-in.
        </p>

        <form onSubmit={handleVerify} autoComplete="off">
          <div className="mb-6">
            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={loading}
              error={!!error}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5 mb-4 text-center"
            >
              {error}
            </motion.p>
          )}

          <PrimaryButton type="submit" loading={loading} className="w-full">
            Verify code
          </PrimaryButton>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            className="text-[13px] font-medium text-loam hover:text-indigo transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
              </span>
            ) : resendCooldown > 0 ? (
              `Resend code in ${resendCooldown}s`
            ) : (
              "Resend code"
            )}
          </button>

          <button
            onClick={handleSignOut}
            className="text-[13px] font-medium text-ink-soft hover:text-ink transition flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </motion.div>
    </AuthLayout>
  );
}

export default function VerifyLoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "rgb(var(--color-parchment) / 1)" }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-loam" />
        </div>
      }
    >
      <VerifyLoginContent />
    </Suspense>
  );
}
