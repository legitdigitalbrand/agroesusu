"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { PinInput } from "@/components/auth/PinInput";
import { LoginRightPanel } from "@/components/auth/RightPanel";

export default function SetPinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"create" | "confirm">("create");

  const handleCreate = () => {
    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }
    setError(null);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (pin !== confirmPin) {
      setError("PINs don't match. Please re-enter.");
      setConfirmPin("");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/pin-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to set up PIN");
        setLoading(false);
        return;
      }

      // PIN set up successfully — redirect to dashboard
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

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-loam/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-loam" />
          </div>
          <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15]">
            Set up your PIN
          </h2>
        </div>

        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          {step === "create"
            ? "Create a 4-digit PIN for fast sign-in on this device. You'll use this PIN every time you open Agriqcap."
            : "Re-enter your PIN to confirm."}
        </p>

        {step === "create" ? (
          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft block mb-3 text-center">
              Create PIN
            </label>
            <PinInput value={pin} onChange={setPin} />

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5 mb-4 mt-4 text-center"
              >
                {error}
              </motion.p>
            )}

            <PrimaryButton
              loading={false}
              disabled={pin.length < 4}
              onClick={handleCreate}
              type="button"
            >
              Continue
            </PrimaryButton>
          </div>
        ) : (
          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft block mb-3 text-center">
              Confirm PIN
            </label>
            <PinInput value={confirmPin} onChange={setConfirmPin} />

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5 mb-4 mt-4 text-center"
              >
                {error}
              </motion.p>
            )}

            <PrimaryButton
              loading={loading}
              disabled={loading || confirmPin.length < 4}
              onClick={handleConfirm}
              type="button"
            >
              Save PIN &amp; continue
            </PrimaryButton>

            <div className="text-center mt-4">
              <button
                onClick={() => {
                  setStep("create");
                  setPin("");
                  setConfirmPin("");
                  setError(null);
                }}
                className="text-[13px] text-ink-soft font-medium hover:text-ink transition"
              >
                ← Start over
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 p-3 bg-loam/5 rounded-xl border border-loam/10">
          <p className="text-[11px] text-ink-soft leading-relaxed">
            <strong className="text-ink">Why do I need a PIN?</strong> Your PIN is a fast,
            secure way to sign in on this device. You can always use your email and password
            if you forget your PIN.
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
