"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { validatePassword, passwordRules } from "@/lib/password";
import { COUNTRIES, DEFAULT_COUNTRY, toE164, isValidLocalPhone, type Country } from "@/lib/countries";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SwitchAuthLink } from "@/components/auth/SwitchAuthLink";
import { SignupRightPanel } from "@/components/auth/RightPanel";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false); // reveal all field errors after first submit attempt

  // ── Field-level validation (live, no native browser popups) ──
  const errors = {
    firstName: firstName.trim().length >= 2 ? null : "Enter your first name",
    lastName: lastName.trim().length >= 2 ? null : "Enter your last name",
    email: EMAIL_RE.test(email.trim()) ? null : "Enter a valid email address",
    phone: isValidLocalPhone(phone, country) ? null : `Enter a valid ${country.name} phone number`,
    password: validatePassword(password),
    confirmPassword: confirmPassword === password ? null : "Passwords do not match",
  };

  // An error only shows once the user has typed something (or after a submit
  // attempt) — never scream at an empty form on first render.
  const show = (field: keyof typeof errors, value: string): string | null =>
    submitted || value !== "" ? errors[field] : null;

  const formValid =
    !errors.firstName && !errors.lastName && !errors.email && !errors.phone &&
    !errors.password && !errors.confirmPassword && agreeTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!formValid) {
      // Field errors are shown inline; the toast just flags that something needs attention.
      toast({
        variant: "destructive",
        title: "Please complete the highlighted fields",
        description: "Some details are missing or incorrect before we can create your account.",
      });
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const phoneE164 = toE164(phone, country);

    let data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data'] = { user: null, session: null };
    try {
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phoneE164,
            country: country.code,
            signup_method: "manual",
            profile_complete: true,
          },
        },
      });
      data = result.data;
      if (result.error) {
        toast({ variant: "destructive", title: "Sign up failed", description: result.error.message });
        setLoading(false);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Failed to fetch") || msg.includes("ERR_")) {
        toast({
          variant: "destructive",
          title: "Connection problem",
          description: "Unable to reach the authentication service. Check your internet and try again.",
        });
      } else {
        toast({ variant: "destructive", title: "Sign up failed", description: msg || "Please try again." });
      }
      setLoading(false);
      return;
    }

    if (!data.user) {
      toast({ variant: "destructive", title: "Account creation failed", description: "Please try again." });
      setLoading(false);
      return;
    }

    // Bootstrap customer + wallet
    try {
      await fetch("/api/bootstrap", { method: "POST" });
    } catch (err) {
      console.error("[signup] Bootstrap error:", err);
    }

    if (data.session) {
      router.push("/login/pin/setup?next=/onboarding&first_run=1");
      router.refresh();
    } else {
      router.push("/verify-email?email=" + encodeURIComponent(email.trim()));
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

        {/* noValidate — the browser's native bubbles are replaced by the
            inline field errors + toast below for a consistent experience. */}
        <form onSubmit={handleSubmit} noValidate autoComplete="off" spellCheck={false}>
          {/* Honeypot inputs to prevent browser password autofill */}
          <input type="password" name="password" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} tabIndex={-1} autoComplete="off" />
          <input type="text" name="email" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} tabIndex={-1} autoComplete="off" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AuthInput
              label="First name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Adaeze"
              autoComplete="given-name"
              error={show("firstName", firstName)}
            />
            <AuthInput
              label="Last name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Okoro"
              autoComplete="family-name"
              error={show("lastName", lastName)}
            />
          </div>

          <AuthInput
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email" autoCapitalize="off" spellCheck={false}
            error={show("email", email)}
          />

          {/* Phone with country code — dropdown defaults to Nigeria.
              Stored as E.164 (+234...) so SMS/OTP works without reformatting. */}
          <div className="mb-5">
            <label htmlFor="phone-country" className="block font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft mb-2">
              Phone number
            </label>
            <div className="flex gap-2">
              <select
                id="phone-country"
                value={country.code}
                onChange={(e) => {
                  const next = COUNTRIES.find((c) => c.code === e.target.value);
                  if (next) setCountry(next);
                }}
                className="auth-input w-[132px] shrink-0 px-2 cursor-pointer"
                aria-label="Country code"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} {c.dial}
                  </option>
                ))}
              </select>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[14px] font-semibold text-ink-soft pointer-events-none">
                  {country.dial}
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={country.code === "NG" ? "801 234 5678" : "712 345 678"}
                  autoComplete="tel-national"
                  aria-invalid={!!show("phone", phone)}
                  className="auth-input pl-[62px] font-mono"
                />
              </div>
            </div>
            {show("phone", phone) && (
              <p role="alert" className="mt-1.5 text-[12px] font-medium text-clay">{errors.phone}</p>
            )}
            <p className="mt-1.5 text-[11px] text-ink-soft leading-relaxed">
              {country.name} number — a {country.dial} code is added automatically.
            </p>
          </div>

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            error={show("password", password)}
          />

          {/* Live strength checklist — updates while typing */}
          {password !== "" && (
            <ul className="mb-4 -mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {passwordRules.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li key={rule.id} className={`flex items-center gap-2 text-[11.5px] font-medium ${ok ? "text-loam-dim" : "text-ink-soft"}`}>
                    {ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}

          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            error={show("confirmPassword", confirmPassword)}
            success={
              !errors.confirmPassword && confirmPassword !== "" ? "Passwords match" : null
            }
          />

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

          <PrimaryButton loading={loading} disabled={!formValid || loading}>
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
