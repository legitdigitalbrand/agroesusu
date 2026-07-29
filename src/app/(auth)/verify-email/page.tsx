"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/yield";

export default function VerifyEmailPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-indigo-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center mb-8">
          <span className="font-display text-3xl text-white">Agriqcap</span>
        </Link>

        <div className="bg-paper rounded-2xl shadow-xl p-8 text-center">
          <h1 className="font-display text-2xl text-ink mb-2">Verify your email</h1>
          <p className="text-sm text-ink-soft mb-6">
            We've sent a verification link to your email address. Click the link to verify your account.
          </p>

          {sent && (
            <p className="text-sm text-loam mb-4">Verification email re-sent. Check your inbox.</p>
          )}

          <Button
            className="w-full mb-3"
            onClick={() => setSent(true)}
          >
            Resend verification email
          </Button>

          <Link href="/dashboard" className="text-sm text-indigo hover:underline block">
            Skip for now →
          </Link>
        </div>
      </div>
    </div>
  );
}
