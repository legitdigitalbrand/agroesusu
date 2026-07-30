"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { deviceHasPin, getDeviceId, ensureDeviceId, setDeviceHasPin, clearDevicePin } from "@/lib/auth/device";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { OtpInput } from "@/components/auth/OtpInput";
import { PinInput } from "@/components/auth/PinInput";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { Loader2, ArrowLeft } from "lucide-react";

type LoginStep = "email" | "otp" | "pin" | "pin-setup" | "verifying";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pinRemaining, setPinRemaining] = useState(5);
  const otpSentRef = useRef(false);

  // On mount: check if device has PIN and session is still valid
  useEffect(() => {
    const checkPin = async () => {
      if (!deviceHasPin()) return;
      const deviceId = getDeviceId();
      if (!deviceId) return;

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Session still valid → show PIN entry
        setStep("pin");
      }
      // If no session, stay on email step (PIN can't help)
    };
    checkPin();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCooldown]);

  // ── Step 1: Send OTP to email ──
  const sendOtp = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setStep("otp");
    setResendCooldown(60);
    otpSentRef.current = true;
    setLoading(false);
  };

  // ── Step 2: Verify OTP ──
  const verifyOtp = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "email",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    // OTP verified — session created
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Authentication failed. Please try again.");
      setLoading(false);
      return;
    }

    // Check if staff
    const { data: isStaff } = await supabase.rpc("is_staff");
    if (isStaff) {
      router.push("/admin/dashboard");
      router.refresh();
      return;
    }

    // Bootstrap customer + wallet if needed
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

    // Offer PIN setup (only if device doesn't already have a PIN)
    if (!deviceHasPin()) {
      setStep("pin-setup");
      setLoading(false);
    } else {
      // Already has PIN on this device — go straight to dashboard
      router.push(redirectPath);
      router.refresh();
    }
  };

  // ── Step 3a: Set up PIN (after OTP) ──
  const setupPin = async () => {
    if (pin.length !== 4 || pin !== confirmPin) {
      setError("PINs don't match. Please re-enter.");
      return;
    }
    setLoading(true);
    setError(null);

    const deviceId = ensureDeviceId();

    try {
      const res = await fetch("/api/auth/pin-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, deviceId }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to set up PIN");
        setLoading(false);
        return;
      }

      setDeviceHasPin(true);
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  // ── Step 3b: Verify PIN (returning user) ──
  const verifyPin = async () => {
    setLoading(true);
    setError(null);
    const deviceId = getDeviceId();

    if (!deviceId) {
      setError("Device not recognized. Please use email sign-in.");
      setStep("email");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/pin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, deviceId }),
      });

      const body = await res.json();

      if (res.ok) {
        // PIN verified, session refreshed → dashboard
        router.push(redirectPath);
        router.refresh();
        return;
      }

      if (body.code === "locked" || body.code === "session_expired" || body.code === "no_session") {
        // Force email OTP
        clearDevicePin();
        setError(body.error);
        setPin("");
        setStep("email");
        setLoading(false);
        return;
      }

      if (body.code === "wrong_pin") {
        setPinRemaining(body.remaining || 0);
        setError(body.error);
        setPin("");
        setLoading(false);
        return;
      }

      setError(body.error || "PIN verification failed");
      setLoading(false);
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  // ── Skip PIN setup ──
  const skipPinSetup = () => {
    router.push(redirectPath);
    router.refresh();
  };

  // ── Use email instead (from PIN screen) ──
  const switchToEmail = async () => {
    const deviceId = getDeviceId();
    if (deviceId) {
      try {
        await fetch("/api/auth/pin-remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });
      } catch {}
    }
    clearDevicePin();
    setPin("");
    setError(null);
    setStep("email");
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <AnimatePresence mode="wait">
        {/* ── EMAIL STEP ── */}
        {step === "email" && (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Welcome back.
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Enter your email and we&apos;ll send you a one-time code.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
              <AuthInput
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
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
                Send code
              </PrimaryButton>
            </form>

            <SwitchAuthLink
              text="No account?"
              linkText="Create one free →"
              href="/signup"
            />
          </motion.div>
        )}

        {/* ── OTP STEP ── */}
        {step === "otp" && (
          <motion.div
            key="otp"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => { setStep("email"); setOtpCode(""); setError(null); }}
              className="flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink transition mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Check your email
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>
            </p>

            <form onSubmit={(e) => { e.preventDefault(); if (otpCode.length === 6) verifyOtp(); }}>
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                error={!!error}
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5 mb-4 mt-4 text-center"
                >
                  {error}
                </motion.p>
              )}

              <PrimaryButton loading={loading} disabled={loading || otpCode.length < 6}>
                Verify code
              </PrimaryButton>
            </form>

            <div className="text-center mt-5">
              {resendCooldown > 0 ? (
                <p className="text-[12px] text-ink-soft">
                  Resend code in {resendCooldown}s
                </p>
              ) : (
                <button
                  onClick={sendOtp}
                  className="text-[13px] text-loam font-medium hover:text-indigo transition"
                >
                  Resend code
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── PIN SETUP STEP ── */}
        {step === "pin-setup" && (
          <motion.div
            key="pin-setup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Set up a 4-digit PIN
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              For faster sign-in on this device next time. You can skip this and use email every time.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); if (pin.length === 4 && confirmPin.length === 4) setupPin(); }}>
              <div className="mb-6">
                <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft block mb-3 text-center">
                  Enter PIN
                </label>
                <PinInput value={pin} onChange={setPin} />
              </div>

              <div className="mb-4">
                <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft block mb-3 text-center">
                  Confirm PIN
                </label>
                <PinInput value={confirmPin} onChange={setConfirmPin} autoFocus={false} />
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

              <PrimaryButton loading={loading} disabled={loading || pin.length < 4 || confirmPin.length < 4}>
                Save PIN
              </PrimaryButton>
            </form>

            <div className="text-center mt-4">
              <button
                onClick={skipPinSetup}
                className="text-[13px] text-ink-soft font-medium hover:text-ink transition"
              >
                Skip — use email every time
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PIN ENTRY STEP (returning user) ── */}
        {step === "pin" && (
          <motion.div
            key="pin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Enter your PIN
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Quick sign-in for this device.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); if (pin.length === 4) verifyPin(); }}>
              <PinInput value={pin} onChange={setPin} error={!!error} />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5 mb-4 mt-4 text-center"
                >
                  {error}
                </motion.p>
              )}

              {pinRemaining < 5 && pinRemaining > 0 && !error && (
                <p className="text-[12px] text-clay text-center mb-3">
                  {pinRemaining} attempts remaining
                </p>
              )}

              <PrimaryButton loading={loading} disabled={loading || pin.length < 4}>
                Unlock
              </PrimaryButton>
            </form>

            <div className="text-center mt-5">
              <button
                onClick={switchToEmail}
                className="text-[13px] text-loam font-medium hover:text-indigo transition"
              >
                Use email instead
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f4f0" }}>
        <Loader2 className="h-6 w-6 animate-spin text-loam" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
