"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { LoginRightPanel } from "@/components/auth/RightPanel";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must include uppercase, lowercase, and a number");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/login");
    router.refresh();
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
          Set new password
        </h2>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit}>
          <PasswordInput
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <p className="text-[11px] text-ink-soft mb-4 leading-relaxed">
            Min 8 characters with at least one uppercase, lowercase, and number.
          </p>

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
            Update password
          </PrimaryButton>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
