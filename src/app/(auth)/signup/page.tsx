"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ensureDeviceId, setDeviceHasPin } from "@/lib/auth/device";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { OtpInput } from "@/components/auth/OtpInput";
import { PinInput } from "@/components/auth/PinInput";
import { SignupRightPanel } from "@/components/auth/RightPanel";
import { ArrowLeft } from "lucide-react";

type SignupStep = "details" | "otp" | "pin-setup";

function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<SignupStep>("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Step 1: Send OTP (creates account) ──
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // signInWithOtp with shouldCreateUser: true will create the account
    // and send a 6-digit code to the email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: fullName,
          phone,
          signup_method: "manual",
          profile_complete: true,
        },
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
    setLoading(false);
  };

  // ── Step 2: Verify OTP ──
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;

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

    // Account created — bootstrap customer + wallet
    try {
      await fetch("/api/bootstrap", { method: "POST" });
    } catch (err) {
      console.error("[signup] Bootstrap error:", err);
    }

    // Offer PIN setup
    setStep("pin-setup");
    setLoading(false);
  };

  // ── Step 3: Set up PIN ──
  const setupPin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  // ── Skip PIN setup ──
  const skipPinSetup = () => {
    router.push("/dashboard");
    router.refresh();
  };

  // ── Resend OTP ──
  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: fullName,
          phone,
          signup_method: "manual",
          profile_complete: true,
        },
      },
    });

    if (otpError) {
      setError(otpError.message);
    } else {
      setResendCooldown(60);
    }
    setLoading(false);
  };

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCooldown]);

  return (
    <AuthLayout rightPanel={<SignupRightPanel />}>
      <AuthLogo />

      <AnimatePresence mode="wait">
        {/* ── DETAILS STEP ── */}
        {step === "details" && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Start saving<br />today.
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Open your account in under 2 minutes
            </p>

            <form onSubmit={sendOtp}>
              <AuthInput
                label="Full name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={3}
                placeholder="Adaeze Okoro"
                autoComplete="name"
              />

              <AuthInput
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />

              <AuthInput
                label="Phone number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="08123456789"
                autoComplete="tel"
                className="font-mono"
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
                Create my account →
              </PrimaryButton>
            </form>

            <p className="text-[12px] text-ink-soft mt-4 text-center leading-relaxed">
              By signing up you agree to our{" "}
              <Link href="/terms" className="text-indigo font-medium">Terms of Service</Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-indigo font-medium">Privacy Policy</Link>
            </p>

            <SwitchAuthLink
              text="Have an account?"
              linkText="Sign in →"
              href="/login"
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
              onClick={() => { setStep("details"); setOtpCode(""); setError(null); }}
              className="flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink transition mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Verify your email
            </h2>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>
            </p>

            <form onSubmit={verifyOtp}>
              <OtpInput value={otpCode} onChange={setOtpCode} error={!!error} />

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
                Verify &amp; create account
              </PrimaryButton>
            </form>

            <div className="text-center mt-5">
              {resendCooldown > 0 ? (
                <p className="text-[12px] text-ink-soft">
                  Resend code in {resendCooldown}s
                </p>
              ) : (
                <button
                  onClick={resendOtp}
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

            <form onSubmit={setupPin}>
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
      </AnimatePresence>
    </AuthLayout>
  );
}

export default SignupPage;
