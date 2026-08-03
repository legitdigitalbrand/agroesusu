"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { PinInput } from "@/components/auth/PinInput";
import { LoginRightPanel } from "@/components/auth/RightPanel";

export default function ForgotPinPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"auth" | "new-pin">("auth");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setStep("new-pin");
    setLoading(false);
  };

  const handleNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || newPin !== confirmPin) {
      setError("PINs don't match. Please re-enter.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/pin-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to set up PIN");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <AnimatePresence mode="wait">
        {step === "auth" && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Reset your PIN
            </h1>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Verify your identity with email and password to set a new PIN.
            </p>

            <form onSubmit={handleAuth} autoComplete="off" spellCheck={false}>
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
                autoComplete="off"
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
                Verify identity
              </PrimaryButton>
            </form>

            <SwitchAuthLink
              text="Forgot password too?"
              linkText="Reset password →"
              href="/forgot-password"
            />
          </motion.div>
        )}

        {step === "new-pin" && (
          <motion.div
            key="new-pin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Create new PIN
            </h1>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Set a new 4-digit PIN for this device.
            </p>

            <form onSubmit={handleNewPin} autoComplete="off" spellCheck={false}>
              <div className="mb-6">
                <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft block mb-3 text-center">
                  New PIN
                </label>
                <PinInput value={newPin} onChange={setNewPin} />
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

              <PrimaryButton loading={loading} disabled={loading || newPin.length < 4 || confirmPin.length < 4}>
                Save new PIN
              </PrimaryButton>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
