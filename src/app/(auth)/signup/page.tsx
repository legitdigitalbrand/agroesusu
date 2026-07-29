"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { SignupRightPanel } from "@/components/auth/RightPanel";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ════════════════════════════════════════════════════════════
  // AUTH LOGIC — UNCHANGED
  // ════════════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Account creation failed. Please try again.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/bootstrap", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[signup] Bootstrap failed:", body);
      }
    } catch (err) {
      console.error("[signup] Bootstrap error:", err);
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <AuthLayout rightPanel={<SignupRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Start saving<br />today.
        </h2>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          Open your account in under 2 minutes
        </p>

        <form onSubmit={handleSubmit}>
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

          <div className="grid grid-cols-2 gap-3">
            <AuthInput
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="08123456789"
              autoComplete="tel"
              className="font-mono"
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

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
    </AuthLayout>
  );
}
