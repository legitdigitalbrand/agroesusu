"use client";

/**
 * Contextual identity verification (BVN/NIN with Safe Haven OTP).
 *
 * Reached from the wallet (funding account), dashboard and loan CTAs when
 * a real provider-verified identity is required. NOT the onboarding flow —
 * onboarding is optional and this page is task-focused: verify → return to
 * where you came from (default: wallet, which auto-provisions the funding
 * account on the next visit).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { Card, Button } from "@/components/yield";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const redirectTo = searchParams.get("redirect") || "/wallet";

  const [step, setStep] = useState<"enter" | "otp" | "verified">("enter");
  const [type, setType] = useState<"BVN" | "NIN">("BVN");
  const [number, setNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [identityId, setIdentityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const otpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => () => {
    if (otpTimeoutRef.current) clearTimeout(otpTimeoutRef.current);
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["wallet-funding-details"] });
    queryClient.invalidateQueries({ queryKey: ["verification-tier"] });
    queryClient.invalidateQueries({ queryKey: ["loan-eligibility"] });
  }, [queryClient]);

  const handleInitiate = useCallback(async () => {
    if (number.length !== 11 || saving) return;
    setSaving(true);
    setError(null);
    otpTimeoutRef.current = setTimeout(() => {
      setSaving(false);
      setError("Request timed out. Check your connection and try again.");
    }, 30000);
    try {
      const res = await fetch("/api/provisioning/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, number }),
      });
      if (otpTimeoutRef.current) clearTimeout(otpTimeoutRef.current);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start verification. Please try again.");
        setSaving(false);
        return;
      }
      // Auto-repair path: identity was already verified — status fixed server-side.
      if (data.status === "already_verified_repaired" || data.repaired) {
        invalidateAll();
        setStep("verified");
        setSaving(false);
        return;
      }
      setIdentityId(data.identityId);
      setInfo(data.message || `OTP sent to the phone number registered with your ${type}.`);
      setStep("otp");
      setCooldown(60);
    } catch {
      if (otpTimeoutRef.current) clearTimeout(otpTimeoutRef.current);
      setError("Network error. Please check your connection and try again.");
    }
    setSaving(false);
  }, [number, saving, type, invalidateAll]);

  const handleValidate = useCallback(async () => {
    if (otp.length < 4 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/provisioning/identity/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityId, otp, type, number }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "OTP verification failed. Please try again.");
        setSaving(false);
        return;
      }
      invalidateAll();
      setStep("verified");
    } catch {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  }, [otp, saving, identityId, type, number, invalidateAll]);

  const inputCls =
    "w-full h-12 rounded-xl border border-input bg-card px-4 text-ink text-base tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-indigo/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-indigo" />
        </div>
        <div>
          <h1 className="font-display text-xl text-ink">Verify your identity</h1>
          <p className="text-sm text-ink-soft">
            {step === "verified"
              ? "You're verified."
              : "Required to create your funding account and unlock loans."}
          </p>
        </div>
      </div>

      <Card className="p-6">
        {step === "enter" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setType("BVN")}
                className={`h-11 rounded-xl border text-sm font-medium transition ${
                  type === "BVN"
                    ? "border-indigo bg-indigo/5 text-indigo"
                    : "border-input bg-card text-ink-soft hover:text-ink"
                }`}
              >
                BVN
              </button>
              <button
                onClick={() => setType("NIN")}
                className={`h-11 rounded-xl border text-sm font-medium transition ${
                  type === "NIN"
                    ? "border-indigo bg-indigo/5 text-indigo"
                    : "border-input bg-card text-ink-soft hover:text-ink"
                }`}
              >
                NIN
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                {type === "BVN" ? "Bank Verification Number" : "National Identity Number"}
              </label>
              <input
                className={inputCls}
                inputMode="numeric"
                maxLength={11}
                placeholder="Enter 11 digits"
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-clay" role="alert">{error}</p>}

            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleInitiate()}
              disabled={saving || number.length !== 11}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send ${type} OTP`}
            </Button>
            <p className="text-xs text-ink-soft leading-relaxed">
              You&apos;ll receive a one-time password at the phone number registered with your {type}.
            </p>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-5">
            {info && <p className="text-sm text-ink-soft">{info}</p>}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Enter OTP</label>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="One-time password"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-clay" role="alert">{error}</p>}

            <Button
              variant="primary"
              className="w-full"
              onClick={handleValidate}
              disabled={saving || otp.length < 4}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify OTP"}
            </Button>

            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep("enter"); setOtp(""); setError(null); }}
                className="text-sm text-ink-soft hover:text-ink transition inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={() => handleInitiate()}
                disabled={cooldown > 0 || saving}
                className="text-sm text-indigo hover:text-indigo-deep transition disabled:text-ink-soft/50"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
              </button>
            </div>
          </div>
        )}

        {step === "verified" && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-ink">Identity verified</p>
              <p className="text-sm text-ink-soft mt-1">
                Your funding account will be created automatically when you open your wallet.
              </p>
            </div>
            <Button variant="primary" className="w-full" onClick={() => { router.push(redirectTo); router.refresh(); }}>
              Continue
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
