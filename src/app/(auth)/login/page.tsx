"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/auth/device";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { PinInput } from "@/components/auth/PinInput";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { Loader2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const isResetSuccess = searchParams.get("reset") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinRemaining, setPinRemaining] = useState(5);
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [checkingDevice, setCheckingDevice] = useState(true);

  // On mount: check if this device has a PIN and session is still valid
  useEffect(() => {
    if (isResetSuccess) {
      setMode("password");
      setCheckingDevice(false);
      return;
    }

    const checkDevice = async () => {
      const deviceId = getDeviceId();
      if (!deviceId) {
        setCheckingDevice(false);
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Session valid + device has cookie → try PIN mode
        setMode("pin");
      }
      setCheckingDevice(false);
    };
    checkDevice();
  }, [isResetSuccess]);

  // ── Password login ──
  const handlePasswordLogin = async (e: React.FormEvent) => {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Authentication failed");
      setLoading(false);
      return;
    }

    // Call post-login to set pin_verified cookie and check if PIN setup is needed
    try {
      const postRes = await fetch("/api/auth/post-login", { method: "POST" });
      const postBody = await postRes.json();

      // Check if staff
      const { data: isStaff } = await supabase.rpc("is_staff");
      const adminTarget = "/dev/dashboard";
      const customerTarget = redirectPath;

      if (postBody.needsPinSetup) {
        // No PIN on any device → mandatory setup
        router.push("/set-pin");
        router.refresh();
        return;
      }

      // Bootstrap customer if needed (customer only)
      if (!isStaff) {
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
      }

      // User has PIN and just authenticated via password → go to dashboard
      router.push(isStaff ? adminTarget : customerTarget);
      router.refresh();
    } catch (err) {
      console.error("[login] Post-login error:", err);
      router.push(redirectPath);
      router.refresh();
    }
  };

  // ── PIN login ──
  const handlePinLogin = async (e: React.FormEvent) => {
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
        // PIN verified — redirect
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: isStaff } = await supabase.rpc("is_staff");
          if (isStaff) {
            router.push("/dev/dashboard");
          } else {
            router.push(redirectPath);
          }
          router.refresh();
          return;
        }
        router.push(redirectPath);
        router.refresh();
        return;
      }

      if (body.code === "locked") {
        setError(body.error);
        setPin("");
        setPinRemaining(0);
        setLoading(false);
        // Auto-switch to password after a delay
        setTimeout(() => {
          setMode("password");
          setPin("");
          setError(null);
        }, 2000);
        return;
      }

      if (body.code === "no_session" || body.code === "no_device") {
        // Session expired or device not recognized → switch to password
        setMode("password");
        setPin("");
        setError("Session expired. Please sign in with email and password.");
        setLoading(false);
        return;
      }

      // Wrong PIN
      setPinRemaining(body.remaining || 0);
      setError(body.error);
      setPin("");
      setLoading(false);
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  // ── Switch to password mode ──
  const switchToPassword = () => {
    setMode("password");
    setPin("");
    setError(null);
  };

  // ── Switch to PIN mode (if device has PIN) ──
  const switchToPin = () => {
    setMode("pin");
    setPin("");
    setError(null);
  };

  if (checkingDevice) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-parchment) / 1)" }}>
        <Loader2 className="h-6 w-6 animate-spin text-loam" />
      </div>
    );
  }

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <AnimatePresence mode="wait">
        {/* ── PASSWORD MODE ── */}
        {mode === "password" && (
          <motion.div
            key="password"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Welcome back.
            </h1>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Sign in to manage your savings &amp; loans
            </p>

            <form onSubmit={handlePasswordLogin}>
              <AuthInput
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />

              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                hint="Forgot password?"
                hintHref="/forgot-password"
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
                Sign in to Agriqcap
              </PrimaryButton>
            </form>

            {/* Show PIN option if device has PIN cookie */}
            {getDeviceId() && (
              <div className="text-center mt-4">
                <button
                  onClick={switchToPin}
                  className="text-[13px] text-loam font-medium hover:text-indigo transition"
                >
                  Use PIN instead →
                </button>
              </div>
            )}

            <SwitchAuthLink
              text="No account?"
              linkText="Create one free →"
              href="/signup"
            />
          </motion.div>
        )}

        {/* ── PIN MODE ── */}
        {mode === "pin" && (
          <motion.div
            key="pin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
              Enter your PIN
            </h1>
            <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
              Quick sign-in for this device.
            </p>

            <form onSubmit={handlePinLogin}>
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
                type="button"
                onClick={switchToPassword}
                className="text-[13px] text-loam font-medium hover:text-indigo transition"
              >
                Use password instead
              </button>
            </div>
            <div className="text-center mt-3">
              <Link
                href="/forgot-pin"
                className="text-[13px] text-loam font-medium hover:text-indigo transition"
              >
                Forgot PIN?
              </Link>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(var(--color-parchment) / 1)" }}>
        <Loader2 className="h-6 w-6 animate-spin text-loam" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
