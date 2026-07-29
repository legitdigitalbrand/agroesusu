"use client";

import Link from "next/link";
import { LogoMark } from "@/components/yield";

// ════════════════════════════════════════════════════════════
// Welcome / Onboarding — matches the approved mockup exactly:
//   - Full indigo background
//   - Two-tone logo mark (light ring + ochre dot)
//   - Card-stack illustration with coins
//   - Headline: "Grow your savings, together."
//   - Two CTAs: Create account (ochre) / Sign in (outline)
//   - Terms & Privacy fineprint
//
// The ochre "Create account" button is the SINGLE accent on this screen.
// ════════════════════════════════════════════════════════════

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-indigo flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <LogoMark size={28} variant="admin" />
        <span className="font-display font-medium text-[17px] tracking-wide text-white/90">
          Agriqcap
        </span>
      </div>

      {/* Illustration — card stack with coins */}
      <div className="relative h-[190px] w-full max-w-[280px] mb-2">
        {/* Coins */}
        <div className="absolute top-3.5 left-2 h-8.5 w-8.5 h-[34px] w-[34px] rounded-full bg-ochre flex items-center justify-center font-mono text-[13px] font-medium text-ink shadow-lg">
          ₦
        </div>
        <div className="absolute bottom-2 right-2 h-[34px] w-[34px] rounded-full bg-paper flex items-center justify-center font-mono text-[13px] font-medium text-ink shadow-lg">
          ₦
        </div>

        {/* Card stack */}
        <div
          className="absolute top-1/2 left-1/2 w-[150px] h-[96px] rounded-2xl bg-indigo-deep"
          style={{ transform: "translate(-70%, -40%) rotate(-14deg)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-[150px] h-[96px] rounded-2xl bg-loam shadow-xl"
          style={{ transform: "translate(-50%, -55%) rotate(-2deg)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-[150px] h-[96px] rounded-2xl bg-ochre"
          style={{ transform: "translate(-30%, -45%) rotate(12deg)" }}
        >
          <div className="absolute top-3.5 left-3.5 w-8.5 h-5.5 w-[34px] h-[22px] rounded-md bg-ink/20" />
        </div>
      </div>

      {/* Headline */}
      <div className="text-center px-4 mt-4">
        <h1 className="font-display font-bold text-[26px] leading-tight text-white mb-2.5">
          Grow your savings,<br />together.
        </h1>
        <p className="text-[13px] leading-relaxed text-white/70 max-w-[260px] mx-auto">
          Save consistently, build trust, and unlock loans, cooperative support, and investment growth — all in one place.
        </p>
      </div>

      {/* CTAs */}
      <div className="w-full max-w-[280px] mt-7 space-y-2.5">
        <Link
          href="/signup"
          className="block text-center bg-ochre text-ink font-medium text-[14.5px] py-3.5 rounded-[14px] transition hover:bg-ochre-light"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="block text-center bg-transparent text-white/90 font-medium text-[14.5px] py-3 rounded-[14px] border-[1.4px] border-white/40 transition hover:bg-white/5"
        >
          Sign in
        </Link>
      </div>

      {/* Fineprint */}
      <p className="text-[10.5px] text-white/40 text-center mt-6 max-w-[240px] leading-relaxed">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="text-white/60 underline">Terms</Link>
        {" "}&{" "}
        <Link href="/privacy" className="text-white/60 underline">Privacy Policy</Link>
      </p>
    </div>
  );
}
