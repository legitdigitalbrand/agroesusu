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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Password must include an uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Password must include a lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must include a number";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (!agreeTerms) {
      setError("Please accept the Terms of Service to continue");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone,
          signup_method: "manual",
          profile_complete: true,
        },
      },
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

    // Bootstrap customer + wallet
    try {
      await fetch("/api/bootstrap", { method: "POST" });
    } catch (err) {
      console.error("[signup] Bootstrap error:", err);
    }

    // After signup, always go to verify-email (which redirects to onboarding after confirmation)
    // Even in sandbox (auto-confirm), go through onboarding for OTP verification
    if (data.session) {
      // Auto-confirmed — go to mandatory PIN setup
      router.push("/onboarding");
      router.refresh();
    } else {
      // Email verification required
      router.push("/verify-email?email=" + encodeURIComponent(email));
      router.refresh();
    }
  };

  return (
    <AuthLayout rightPanel={<SignupRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <h1 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Start saving<br />today.
        </h1>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          Open your account in under 2 minutes
        </p>

        <form onSubmit={handleSubmit} autoComplete="off" spellCheck={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AuthInput
              label="First name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              minLength={2}
              placeholder="Adaeze"
              autoComplete="given-name"
            />
            <AuthInput
              label="Last name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              minLength={2}
              placeholder="Okoro"
              autoComplete="family-name"
            />
          </div>

          <AuthInput
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email" autoCapitalize="off" spellCheck={false}
          />

          <AuthInput
            label="Phone number"
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

          {/* Password requirements hint */}
          <p className="text-[11px] text-ink-soft mb-4 -mt-2 leading-relaxed">
            Min 8 characters with at least one uppercase, lowercase, and number.
          </p>

          {/* Terms checkbox */}
          <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-ink/20 text-ochre focus:ring-ochre/30"
            />
            <span className="text-[12px] text-ink-soft leading-relaxed">
              I agree to the{" "}
              <Link href="/terms" className="text-indigo font-medium">Terms of Service</Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-indigo font-medium">Privacy Policy</Link>
            </span>
          </label>

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

        <SwitchAuthLink
          text="Have an account?"
          linkText="Sign in →"
          href="/login"
        />
      </motion.div>
    </AuthLayout>
  );
}
