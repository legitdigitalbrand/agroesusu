"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { OtpInput } from "@/components/auth/OtpInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { Loader2, Lock } from "lucide-react";

/**
 * Login PIN verification — step 2 after password sign-in for users who have
 * configured a PIN. The middleware gates all protected pages until the
 * signed PIN cookie is set by a successful verification here.
 */
function PinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine state: no PIN configured yet → first-time setup page.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/login-pin");
        if (res.status === 401) {
          // Not signed in — back to login.
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (!data.has_pin) {
          const params = new URLSearchParams();
          if (redirectPath !== "/dashboard") params.set("redirect", redirectPath);
          router.replace(`/login/pin/setup${params.toString() ? `?${params}` : ""}`);
          return;
        }
      } catch {
        // Stay here on transient errors — user can retry by reloading.
      }
      setChecking(false);
    })();
  }, [router, redirectPath]);

  const handleVerify = useCallback(async () => {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login-pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push(redirectPath);
        router.refresh();
        return;
      }
      setError(data.error || "Incorrect PIN. Please try again.");
      setPin("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [pin, loading, router, redirectPath]);

  const handleSignOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/login");
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <div className="w-full max-w-sm mx-auto p-6">
        <AuthLogo />

        <div className="mt-8 mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl text-white">Enter your PIN</h1>
          <p className="mt-2 text-sm text-white/60">Your login PIN keeps your account extra secure.</p>
        </div>

        {checking ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <OtpInput length={4} value={pin} onChange={setPin} error={!!error} />
            </div>

            {error && (
              <p className="mt-3 text-center text-sm text-red-400" role="alert">{error}</p>
            )}

            <div className="mt-6">
              <PrimaryButton onClick={handleVerify} disabled={pin.length !== 4 || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
              </PrimaryButton>
            </div>

            <button
              onClick={handleSignOut}
              className="mt-4 w-full text-center text-sm text-white/50 hover:text-white/80 transition"
            >
              Sign out instead
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default function PinPage() {
  return (
    <Suspense>
      <PinContent />
    </Suspense>
  );
}
