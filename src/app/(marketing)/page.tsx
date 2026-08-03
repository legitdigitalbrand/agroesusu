"use client";

import Link from "next/link";
import {
  Check, TrendingUp, Clock, Landmark, Shield, Wallet,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Landing Page — Agriqcap
// Active products: Wallet, Savings, Loans
// No fake stats. No cooperative/investment promotions.
// ════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <div className="">
{/* ═══ Hero ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 px-6 md:px-10 py-14 md:py-20 items-center max-w-[1180px] mx-auto">
        {/* Left — copy */}
        <div>
          <span className="inline-block bg-loam-light text-indigo text-[13px] font-semibold px-3.5 py-1.5 rounded-full mb-4">
            Savings-first digital finance
          </span>
          <h1 className="font-display font-bold text-[34px] md:text-[38px] leading-[1.15] text-ink mb-4">
            Save together.<br />
            <span className="text-indigo">Grow</span> together.<br />
            Borrow with <span className="text-loam">confidence.</span>
          </h1>
          <p className="text-[15px] text-ink-soft leading-relaxed max-w-[420px] mb-6">
            Agriqcap helps farmers and small businesses build savings discipline,
            unlock fair loans, and manage money — all in one secure platform.
          </p>
          <div className="flex gap-3 mb-5">
            <Link
              href="/signup"
              className="bg-ochre text-ink font-semibold text-[13px] px-5 py-2.5 rounded-[10px] hover:opacity-90 transition"
            >
              Get started
            </Link>
            <a
              href="#how"
              className="border-[1.4px] border-line text-ink font-medium text-[13px] px-5 py-2.5 rounded-[10px] hover:bg-parchment transition"
            >
              See how it works
            </a>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Check className="w-3.5 h-3.5 text-loam" />
            Powered by a CBN-licensed banking partner · deposits safeguarded
          </div>
        </div>

        {/* Right — visual */}
        <div className="relative h-[340px] flex items-center justify-center">
          {/* Concentric rings */}
          <div className="absolute w-[300px] h-[300px] rounded-full border border-line" />
          <div className="absolute w-[230px] h-[230px] rounded-full border border-line" />

          {/* Floating wallet card */}
          <div className="absolute top-4 right-2 w-[230px] bg-gradient-to-br from-indigo to-indigo-deep text-white rounded-[14px] p-4 shadow-[0_20px_40px_rgba(18,61,21,0.25)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-paper/15 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-ochre" />
              </div>
              <span className="text-[12px] text-white/70">Your wallet</span>
            </div>
            <p className="font-mono text-[22px] font-medium">₦ 0.00</p>
            <p className="text-[12px] text-white/70 mt-1.5">Fund to start saving</p>
          </div>

          {/* Floating savings card */}
          <div className="absolute bottom-6 left-1.5 bg-paper border border-line rounded-[14px] p-3.5 shadow-[0_12px_28px_rgba(18,61,21,0.12)] flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] bg-loam rounded-lg flex items-center justify-center">
              <TrendingUp className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <p className="text-[12px] text-ink-soft m-0">Earn up to</p>
              <p className="font-mono text-[14px] text-ink m-0">12% p.a.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Trust bar ═══ */}
      <section className="bg-indigo-deep flex flex-wrap justify-around py-8 px-6 text-center">
        <div>
          <p className="font-mono text-ochre text-[26px] m-0">CBN</p>
          <p className="text-[13px] text-white/70 m-0 mt-1">Licensed banking partner</p>
        </div>
        <div>
          <p className="font-mono text-ochre text-[26px] m-0">3×</p>
          <p className="text-[13px] text-white/70 m-0 mt-1">Savings-backed loans</p>
        </div>
        <div>
          <p className="font-mono text-ochre text-[26px] m-0">12%</p>
          <p className="text-[13px] text-white/70 m-0 mt-1">Top savings rate</p>
        </div>
      </section>

      {/* ═══ Features grid ═══ */}
      <section id="features" className="py-14 px-6 md:px-10 max-w-[1180px] mx-auto">
        <div className="flex justify-between items-end mb-8 gap-6">
          <h2 className="font-display font-bold text-[26px] leading-[1.3] text-ink max-w-[640px]">
            Everything you need to save, borrow and manage money — nothing you don&apos;t.
          </h2>
          <span className="text-[14px] text-ink-soft whitespace-nowrap">Features</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Image card */}
          <div className="bg-indigo rounded-2xl p-5 flex items-end min-h-[180px]">
            <Wallet className="w-11 h-11 text-ochre" strokeWidth={1.6} />
          </div>
          {/* Feature cards */}
          <FeatureCard
            icon={Clock}
            title="Automated savings & interest"
            desc="Set a goal, save consistently, and watch interest post automatically — no manual tracking."
          />
          <FeatureCard
            icon={Shield}
            title="Bank-grade security"
            desc="PIN-protected access, device verification, and deposits safeguarded by our banking partner."
          />
          <FeatureCard
            icon={Landmark}
            title="Loans based on your savings history"
            desc="Consistent savers unlock fair credit — up to 3× their balance — with no hidden criteria."
          />
        </div>
      </section>

      {/* ═══ Savings detail ═══ */}
      <section id="savings" className="grid grid-cols-1 lg:grid-cols-2 gap-11 px-6 md:px-10 py-10 max-w-[1180px] mx-auto items-center">
        <div>
          <p className="text-loam-dim text-[13px] font-semibold mb-2">Savings</p>
          <h3 className="font-display font-bold text-[23px] text-ink mb-3">
            Secure your future. Earn competitive rates.
          </h3>
          <p className="text-[15px] text-ink-soft leading-relaxed mb-5">
            Whether you&apos;re saving toward next season&apos;s inputs or building a long-term
            fund, Agriqcap&apos;s savings products are built around real agricultural
            cycles — not generic bank terms.
          </p>
          <ul className="space-y-2.5 list-none p-0 m-0">
            <CheckItem>Flexible Savings — withdraw anytime, competitive rate</CheckItem>
            <CheckItem>Harvest Lock Fixed Deposit — 90-day term, up to 12% p.a.</CheckItem>
            <CheckItem>Target Savings — set goals and save consistently</CheckItem>
          </ul>
        </div>
        <div className="space-y-2.5">
          <LandingProductCard name="Flexible Savings" desc="Withdraw anytime" rate="4%" />
          <LandingProductCard name="Harvest Lock" desc="90-day Fixed Deposit" rate="12%" />
        </div>
      </section>

      {/* ═══ Loans detail ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-11 px-6 md:px-10 py-10 max-w-[1180px] mx-auto items-center">
        {/* Visual first on desktop (reversed) */}
        <div className="order-1 lg:order-1">
          <div className="bg-gradient-to-br from-indigo to-indigo-deep text-white rounded-2xl p-5">
            <p className="text-[12px] text-white/70 mb-1">Borrow up to 3× your savings</p>
            <p className="font-mono text-[28px] font-medium mb-3">Fair loans</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="text-white/70">Rates from</span>
                <span className="text-white">15% flat p.a.</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-white/70">Repayment</span>
                <span className="text-white">Harvest-aligned</span>
              </div>
            </div>
          </div>
        </div>
        <div className="order-2 lg:order-2">
          <p className="text-loam-dim text-[13px] font-semibold mb-2">Loans</p>
          <h3 className="font-display font-bold text-[23px] text-ink mb-3">
            Affordable credit to fund your farming season.
          </h3>
          <p className="text-[15px] text-ink-soft leading-relaxed mb-5">
            Agriqcap offers simple, transparent loans sized to your savings and repayment
            schedules that match your harvest cycle.
          </p>
          <ul className="space-y-2.5 list-none p-0 m-0">
            <CheckItem>Borrow up to 3× your savings balance</CheckItem>
            <CheckItem>Flat, transparent rates — no hidden charges</CheckItem>
            <CheckItem>Every decision explained and logged</CheckItem>
          </ul>
        </div>
      </section>

      {/* ═══ 3-step process ═══ */}
      <section id="how" className="px-6 md:px-10 max-w-[1180px] mx-auto pb-10">
        <div className="bg-gradient-to-br from-indigo to-indigo-deep rounded-3xl p-8 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <StepCard num="1" title="Create your account" desc="Sign up in under 2 minutes. Verify your identity to unlock all features." />
          <StepCard num="2" title="Fund your wallet" desc="Add money via bank transfer to your dedicated virtual account." />
          <StepCard num="3" title="Save and borrow" desc="Build savings, earn interest, and unlock fair loans when you need them." />
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <section className="px-6 md:px-10 max-w-[1180px] mx-auto pb-14">
        <div className="bg-loam-light rounded-3xl p-8 md:p-12 text-center">
          <h2 className="font-display font-bold text-[26px] text-ink mb-3">
            Ready to start saving?
          </h2>
          <p className="text-[15px] text-ink-soft max-w-[400px] mx-auto mb-6">
            Join Agriqcap today. Open your account in under 2 minutes.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-ochre text-ink font-semibold text-[14px] px-6 py-3 rounded-[10px] hover:opacity-90 transition"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="bg-indigo-deep py-8 px-6 md:px-10">
        <div className="max-w-[1180px] mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-display font-semibold text-white text-[16px]">Agriqcap</span>
          </div>
          <nav className="flex gap-5 text-[13px] text-white/70">
            <Link href="/features" className="hover:text-white transition">Features</Link>
            <Link href="/about" className="hover:text-white transition">About</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/help" className="hover:text-white transition">Help</Link>
          </nav>
        </div>
        <div className="max-w-[1180px] mx-auto mt-4">
          <p className="text-[12px] text-white/70 text-center">© 2026 Agriqcap. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ───

function FeatureCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="bg-parchment rounded-2xl p-[18px] min-h-[180px] flex flex-col">
      <div className="w-[34px] h-[34px] rounded-[9px] bg-loam-light flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-indigo" strokeWidth={1.8} />
      </div>
      <h4 className="text-[14px] font-medium text-ink mb-2">{title}</h4>
      <p className="text-[12px] text-ink-soft leading-relaxed">{desc}</p>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] text-ink items-start">
      <Check className="w-4 h-4 text-loam flex-shrink-0 mt-0.5" />
      {children}
    </li>
  );
}

function LandingProductCard({ name, desc, rate }: { name: string; desc: string; rate: string }) {
  return (
    <div className="border border-line rounded-2xl p-4 bg-paper flex gap-3 shadow-[0_12px_28px_rgba(18,61,21,0.1)]">
      <div className="w-[42px] h-[42px] rounded-xl bg-loam-light flex items-center justify-center flex-shrink-0">
        <Landmark className="w-[19px] h-[19px] text-indigo" strokeWidth={1.8} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[14px] font-medium text-ink mb-0.5">{name}</p>
            <p className="text-[13px] text-ink-soft">{desc}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[13px] text-loam">{rate}</p>
            <p className="text-[12px] text-ink-soft">p.a.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="text-left">
      <div className="w-8 h-8 rounded-full bg-ochre text-ink font-display font-bold text-[14px] flex items-center justify-center mx-auto mb-2">
        {num}
      </div>
      <h5 className="font-display font-semibold text-[15px] text-white mb-1 text-center">{title}</h5>
      <p className="text-[12px] text-white/70 leading-relaxed text-center">{desc}</p>
    </div>
  );
}
