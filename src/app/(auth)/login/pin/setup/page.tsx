"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { OtpInput } from "@/components/auth/OtpInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * First-time login PIN setup. Reached after sign-in when the user has no PIN
 * yet. Creates the PIN server-side (409 if one already exists) and unlocks
 * the PIN gate.
 */
function PinSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const [step, setStep] = useState<"create" | "confirm">("create");
  const [firstPin, setFirstPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user already has a PIN, they belong on the verify page.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/login-pin");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (data.has_pin) {
          router.replace("/login/pin");
        }
      } catch { /* transient — ignore */ }
    })();
  }, [router]);

  const handleCreate = useCallback(() => {
    if (firstPin.length !== 4) return;
    setStep("confirm");
  }, [firstPin]);

  const handleConfirm = useCallback(async () => {
    if (confirmPin.length !== 4 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login-pin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: firstPin, confirmPin }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // A PIN already exists (race) — verify it instead.
        router.replace("/login/pin");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Could not save your PIN. Please try again.");
        setConfirmPin("");
        return;
      }
      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [confirmPin, loading, firstPin, router, redirectPath]);

  const handleBack = () => {
    setStep("create");
    setConfirmPin("");
    setError(null);
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <div className="w-full max-w-sm mx-auto p-6">
        <AuthLogo />

        <div className="mt-8 mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl text-white">
            {step === "create" ? "Create a login PIN" : "Confirm your PIN"}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {step === "create"
              ? "You'll enter this 4-digit PIN each time you sign in."
              : "Re-enter the PIN to confirm it."}
          </p>
        </div>

        {step === "create" ? (
          <>
            <div className="flex justify-center">
              <OtpInput length={4} value={firstPin} onChange={setFirstPin} />
            </div>
            <div className="mt-6">
              <PrimaryButton onClick={handleCreate} disabled={firstPin.length !== 4}>
                Continue
              </PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <OtpInput length={4} value={confirmPin} onChange={setConfirmPin} error={!!error} />
            </div>
            {error && (
              <p className="mt-3 text-center text-sm text-red-400" role="alert">{error}</p>
            )}
            <div className="mt-6 space-y-3">
              <PrimaryButton onClick={handleConfirm} disabled={confirmPin.length !== 4 || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save PIN"}
              </PrimaryButton>
              <button
                onClick={handleBack}
                className="w-full text-center text-sm text-white/50 hover:text-white/80 transition"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default function PinSetupPage() {
  return (
    <Suspense>
      <PinSetupContent />
    </Suspense>
  );
}
