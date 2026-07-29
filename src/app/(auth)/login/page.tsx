"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { Divider } from "@/components/auth/Divider";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { LoginRightPanel } from "@/components/auth/RightPanel";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (isStaff) {
        router.push("/admin/dashboard");
        router.refresh();
        return;
      }

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

      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <h2 className="font-display text-[24px] font-extrabold text-ink leading-tight mb-1">
          Welcome back.
        </h2>
        <p className="text-[13px] text-ink-soft mb-6">
          Sign in to manage your savings &amp; loans
        </p>

        <form onSubmit={handleSubmit}>
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
              className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2 mb-3"
            >
              {error}
            </motion.p>
          )}

          <PrimaryButton loading={loading} disabled={loading}>
            Sign in to Agriqcap
          </PrimaryButton>
        </form>

        <Divider />

        <SwitchAuthLink
          text="No account?"
          linkText="Create one free →"
          href="/signup"
        />
      </motion.div>
    </AuthLayout>
  );
}
