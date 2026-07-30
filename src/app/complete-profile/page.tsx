"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Loader2, Check } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { PrimaryButton } from "@/components/auth/PrimaryButton";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

function CompleteProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOauth = searchParams.get("oauth") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"details" | "otp" | "done">("details");

  // Pre-filled from Google
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");

  // OTP
  const [otpCode, setOtpCode] = useState("");

  // Load user data on mount
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Pre-fill from auth metadata (Google provides full_name and email)
      const metadata = user.user_metadata || {};
      setFullName(metadata.full_name || metadata.name || "");
      setEmail(user.email || metadata.email || "");

      // Check if phone already exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, residential_address, state, lga")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setFullName(prev => prev || profile.full_name || "");
        setPhone(profile.phone || "");
        setAddress(profile.residential_address || "");
        setState(profile.state || "");
        setLga(profile.lga || "");
      }

      // Check if already complete
      const { data: customer } = await supabase
        .from("customers")
        .select("phone_verified")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (customer?.phone_verified && profile?.residential_address) {
        // Already complete — go to dashboard
        router.push("/dashboard");
        return;
      }

      setLoading(false);
    };
    loadUser();
  }, [router]);

  // Send OTP to the user's phone
  const sendOtp = async () => {
    setError(null);
    const supabase = createClient();
    const fullPhone = phone.startsWith("+234") ? phone : `+234${phone.replace(/^0/, "")}`;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      setError(otpError.message);
      return false;
    }
    return true;
  };

  // Verify OTP
  const verifyOtp = async () => {
    setError(null);
    const supabase = createClient();
    const fullPhone = phone.startsWith("+234") ? phone : `+234${phone.replace(/^0/, "")}`;
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otpCode,
      type: "sms",
    });
    if (verifyError) {
      setError(verifyError.message);
      return false;
    }
    return true;
  };

  // Save profile and create customer record
  const saveProfile = async () => {
    setError(null);
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const signupMethod = isOauth ? "google" : "manual";

    // 1. Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone,
        residential_address: address,
        state: state,
        lga: lga,
      })
      .eq("id", user.id);

    if (profileError) {
      setError("Failed to save profile: " + profileError.message);
      setSaving(false);
      return;
    }

    // 2. Call bootstrap to create customer + wallet (if not exists)
    try {
      const res = await fetch("/api/bootstrap", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[complete-profile] Bootstrap failed:", body);
      }
    } catch (err) {
      console.error("[complete-profile] Bootstrap error:", err);
    }

    // 3. Update customer record with phone_verified, address, signup_method
    const serviceUpdate = await fetch("/api/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_verified: true,
        signup_method: signupMethod,
        full_name: fullName,
        phone: phone,
        residential_address: address,
        state: state,
        lga: lga,
      }),
    });

    if (!serviceUpdate.ok) {
      const body = await serviceUpdate.json().catch(() => ({}));
      setError("Failed to update customer record: " + (body.error || "Unknown error"));
      setSaving(false);
      return;
    }

    // 4. Update auth user metadata to mark profile as complete
    await supabase.auth.updateUser({
      data: { profile_complete: true, full_name: fullName, phone, signup_method: signupMethod },
    });

    setStep("done");
    setSaving(false);

    // Redirect to dashboard after a brief delay
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  };

  // Handle "Continue" from details step → send OTP
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!address || !state) {
      setError("Please enter your residential address and state");
      return;
    }
    setSaving(true);
    setError(null);
    const sent = await sendOtp();
    if (sent) {
      setStep("otp");
    }
    setSaving(false);
  };

  // Handle OTP verification → save profile
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setSaving(true);
    setError(null);
    const verified = await verifyOtp();
    if (verified) {
      await saveProfile();
    } else {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-indigo-deep flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ochre" />
      </div>
    );
  }

  return (
    <AuthLayout rightPanel={null}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Complete your profile
        </h2>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          {isOauth
            ? "We just need a few more details to finish setting up your account."
            : "Verify your phone and add your address to continue."}
        </p>

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            {/* Name (pre-filled from Google) */}
            <div>
              <label className="text-[13px] font-semibold text-ink-soft mb-1.5 block">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={3}
                className="auth-input"
                placeholder="Adaeze Okoro"
              />
            </div>

            {/* Email (pre-filled, read-only for Google users) */}
            <div>
              <label className="text-[13px] font-semibold text-ink-soft mb-1.5 block">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isOauth}
                className="auth-input disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="you@example.com"
              />
            </div>

            {/* Phone — required, will be OTP-verified */}
            <div>
              <label className="text-[13px] font-semibold text-ink-soft mb-1.5 block">
                Phone number <span className="text-clay">*</span>
                <span className="font-normal text-ink-soft ml-1">— we'll send a verification code</span>
              </label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 rounded-xl border border-line bg-parchment text-[15px] font-medium text-ink-soft">
                  +234
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  required
                  className="auth-input font-mono"
                  placeholder="8031234567"
                />
              </div>
            </div>

            {/* Address — required */}
            <div>
              <label className="text-[13px] font-semibold text-ink-soft mb-1.5 block">
                Residential address <span className="text-clay">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="auth-input"
                placeholder="123 Farm Road, Oyo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-semibold text-ink-soft mb-1.5 block">
                  State <span className="text-clay">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  className="auth-input"
                >
                  <option value="">Select state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-ink-soft mb-1.5 block">
                  LGA
                </label>
                <input
                  type="text"
                  value={lga}
                  onChange={(e) => setLga(e.target.value)}
                  className="auth-input"
                  placeholder="LGA"
                />
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5">
                {error}
              </p>
            )}

            <PrimaryButton loading={saving} disabled={saving}>
              Send verification code →
            </PrimaryButton>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="bg-loam/5 border border-loam/20 rounded-xl px-4 py-3 mb-2">
              <p className="text-[13px] text-loam font-medium">
                We sent a 6-digit code to +234{phone.replace(/^0/, "")}
              </p>
            </div>

            <div>
              <label className="text-[13px] font-semibold text-ink-soft mb-1.5 block">
                Verification code
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                required
                maxLength={6}
                className="auth-input font-mono text-center text-[22px] tracking-[0.5em]"
                placeholder="000000"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5">
                {error}
              </p>
            )}

            <PrimaryButton loading={saving} disabled={saving}>
              Verify & complete →
            </PrimaryButton>

            <button
              type="button"
              onClick={() => { setStep("details"); setOtpCode(""); setError(null); }}
              className="w-full text-[13px] text-ink-soft hover:text-ink text-center"
            >
              ← Back to edit details
            </button>
          </form>
        )}

        {step === "done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="h-16 w-16 rounded-full bg-loam/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-loam" />
            </div>
            <h3 className="font-display text-xl text-ink mb-2">Profile complete!</h3>
            <p className="text-[14px] text-ink-soft">Redirecting to your dashboard…</p>
          </motion.div>
        )}
      </motion.div>
    </AuthLayout>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-indigo-deep flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ochre" />
      </div>
    }>
      <CompleteProfileContent />
    </Suspense>
  );
}
