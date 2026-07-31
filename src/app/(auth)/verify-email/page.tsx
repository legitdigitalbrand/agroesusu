"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { LoginRightPanel } from "@/components/auth/RightPanel";
import { Loader2, MailCheck } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  // Poll for email confirmation (auto-confirm in sandbox = instant)
  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/set-pin");
        router.refresh();
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <AuthLayout rightPanel={<LoginRightPanel />}>
      <AuthLogo />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-loam/10 flex items-center justify-center mx-auto mb-6">
          <MailCheck className="w-8 h-8 text-loam" />
        </div>

        <h2 className="font-display text-[28px] font-extrabold text-ink leading-[1.15] mb-2">
          Verify your email
        </h2>
        <p className="text-[14px] text-ink-soft mb-8 leading-relaxed">
          We sent a verification link to{" "}
          <span className="font-medium text-ink">{email || "your email"}</span>.
          Click the link to activate your account.
        </p>

        <div className="flex items-center justify-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for verification...
        </div>

        <div className="mt-6">
          <a href="/login" className="text-[13px] text-loam font-medium hover:text-indigo transition">← Back to sign in</a>
        </div>
      </motion.div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f4f0" }}>
        <Loader2 className="h-6 w-6 animate-spin text-loam" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
