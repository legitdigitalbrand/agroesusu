"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/yield";

export default function VerifyEmailPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-indigo flex flex-col items-center justify-center px-6 py-10">
      <div className="flex items-center gap-2 mb-6">
        <LogoMark size={28} variant="admin" />
        <span className="font-display font-medium text-[17px] tracking-wide text-white/90">
          Agriqcap
        </span>
      </div>

      <div className="text-center mb-5">
        <h1 className="font-display font-bold text-[26px] leading-tight text-white mb-2">
          Verify your email
        </h1>
        <p className="text-[13px] text-white/70 max-w-[280px] mx-auto">
          We've sent a verification link to your email. Click the link to verify your account.
        </p>
      </div>

      <div className="w-full max-w-[340px] space-y-3">
        {sent && (
          <p className="text-[13px] text-ochre text-center mb-2">
            Verification email re-sent. Check your inbox.
          </p>
        )}
        <button
          onClick={() => setSent(true)}
          className="w-full bg-ochre text-ink font-medium text-[15px] py-3.5 rounded-[14px] hover:bg-ochre-light transition"
        >
          Resend verification email
        </button>
        <Link
          href="/dashboard"
          className="block text-center text-[14px] text-white/70 hover:text-white transition py-2"
        >
          Skip for now →
        </Link>
      </div>
    </div>
  );
}
