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
  const redirectPath = searchParams.get("next") || searchParams.get("redirect") || "/dashboard";
  const isFirstRun = searchParams.get("first_run") === "1";

  const [step, setStep] = useState<"create" | "confirm">("create");
  const [firstPin, setFirstPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user already has a PIN, they belong on the verify page.
  // 401s right after signup are almost always the session-cookie race
  // (navigation lands before the sb auth cookie is visible to the API) —
  // retry a few times before bouncing to /login, otherwise first-time
  // users see the PIN page flash and disappear.
  useEffect(() => {
    let cancelled = false;
    const check = async (attempt: number) => {
      try {
        const res = await fetch("/api/auth/login-pin", { cache: "no-store" });
        if (res.status === 401) {
          if (attempt < 4) {
            setTimeout(() => { if (!cancelled) check(attempt + 1); }, 700);
            return;
          }
          if (!cancelled) router.replace("/login");
          return;
        }
        const data = await res.json();
        if (!cancelled && data.has_pin) router.replace("/login/pin");
      } catch { /* transient — ignore */ }
    };
    check(0);
    return () => { cancelled = true; };
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-parchment border border-line">
            <ShieldCheck className="h-6 w-6 text-indigo" />
          </div>
          <h1 className="font-display text-2xl text-ink">
            {step === "create" ? "Create your Security PIN" : "Confirm your PIN"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {step === "create"
              ? "One 4-digit PIN unlocks your account and authorises every transfer."
              : "Re-enter the PIN to confirm it."}
          </p>
        </div>

        {step === "create" ? (
          <>
            <div className="flex justify-center">
              <OtpInput length={4} value={firstPin} onChange={setFirstPin} />
            </div>
            <div className="mt-6 space-y-3">
              <PrimaryButton onClick={handleCreate} disabled={firstPin.length !== 4}>
                Continue
              </PrimaryButton>
              {isFirstRun && (
                <button
                  onClick={() => router.push(redirectPath)}
                  className="w-full text-center text-sm text-ink-soft hover:text-ink transition"
                >
                  Skip for now
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <OtpInput length={4} value={confirmPin} onChange={setConfirmPin} error={!!error} />
            </div>
            {error && (
              <p className="mt-3 text-center text-sm text-clay" role="alert">{error}</p>
            )}
            <div className="mt-6 space-y-3">
              <PrimaryButton onClick={handleConfirm} disabled={confirmPin.length !== 4 || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save PIN"}
              </PrimaryButton>
              <button
                onClick={handleBack}
                className="w-full text-center text-sm text-ink-soft hover:text-ink transition"
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
