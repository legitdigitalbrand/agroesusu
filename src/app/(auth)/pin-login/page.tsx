"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { PinInput } from "@/components/auth/PinInput";
import { LoginRightPanel } from "@/components/auth/RightPanel";

export default function PinLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinRemaining, setPinRemaining] = useState(5);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/pin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const body = await res.json();

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (body.code === "pin_locked") {
        setError(body.error);
        setPin("");
        setPinRemaining(0);
        setLoading(false);
        return;
      }

      if (body.code === "no_session" || body.code === "no_device") {
        // Session expired → go to password login
        router.push("/login");
        router.refresh();
        return;
      }

      // Wrong PIN
      setPinRemaining(body.attempts_remaining || 0);
      setError(body.error);
      setPin("");
      setLoading(false);
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Enter your PIN
        </h2>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          Welcome back. Enter your 4-digit PIN to continue.
        </p>

        <form onSubmit={handleVerify}>
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

        <div className="text-center mt-5 space-y-2">
          <button
            onClick={() => router.push("/login")}
            className="block text-[13px] text-loam font-medium hover:text-indigo transition"
          >
            Use password instead
          </button>
          <button
            onClick={() => router.push("/forgot-pin")}
            className="block text-[13px] text-ink-soft font-medium hover:text-ink transition"
          >
            Forgot PIN?
          </button>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
