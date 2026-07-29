"use client";

import Link from "next/link";
import {
  Check, TrendingUp, Clock, Users, Landmark,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Landing Page — matches yield-ui-mockups2.html "Landing page" screen
//
// Structure:
//   1. Nav bar (logo, links, login, "Get started")
//   2. Hero (eyebrow, colored headline, floating cards visual)
//   3. Stats bar (indigo-deep bg, 3 stats)
//   4. Features grid (4-col: 1 image card + 3 feature cards)
//   5. Savings detail (2-col: copy + product cards)
//   6. Loans detail (2-col reversed: copy + eligibility card)
//   7. 3-step process (indigo gradient)
//   8. Final CTA
//   9. Footer
//
// Design: Yield tokens only, Plus Jakarta Sans headlines, IBM Plex Mono numbers
// ════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <div className="">
{/* ═══ Hero ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 px-6 md:px-10 py-14 md:py-20 items-center max-w-[1180px] mx-auto">
        {/* Left — copy */}
        <div>
          <span className="inline-block bg-loam-light text-indigo text-[11.5px] font-semibold px-3.5 py-1.5 rounded-full mb-4">
            Savings-first cooperative finance
          </span>
          <h1 className="font-display font-bold text-[34px] md:text-[38px] leading-[1.15] text-ink mb-4">
            Save together.<br />
            <span className="text-indigo">Grow</span> together.<br />
            Borrow with <span className="text-loam">confidence.</span>
          </h1>
          <p className="text-[14.5px] text-ink-soft leading-relaxed max-w-[420px] mb-6">
            Agriqcap helps farmers, cooperatives and small businesses build savings discipline,
            unlock fair loans, and grow through group investment — all in one secure platform.
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
          <div className="flex items-center gap-2 text-[11.5px] text-ink-soft">
            <Check className="w-3.5 h-3.5 text-loam" />
            Powered by a CBN-licensed banking partner · deposits safeguarded
          </div>
        </div>

        {/* Right — visual */}
        <div className="relative h-[340px] flex items-center justify-center">
          {/* Concentric rings */}
          <div className="absolute w-[300px] h-[300px] rounded-full border border-line" />
          <div className="absolute w-[230px] h-[230px] rounded-full border border-line" />

          {/* Floating balance card */}
          <div className="absolute top-4 right-2 w-[230px] bg-gradient-to-br from-indigo to-[#0F4A13] text-white rounded-[14px] p-4 shadow-[0_20px_40px_rgba(18,61,21,0.25)]">
            <p className="text-[12px] text-[#BFE0BE] mb-1.5">Dry season fund</p>
            <p className="font-mono text-[22px] font-medium">₦134,000</p>
            <p className="text-[10.5px] text-[#9FC79B] mt-1.5">67% of ₦200,000 goal</p>
          </div>

          {/* Floating stat card */}
          <div className="absolute bottom-6 left-1.5 bg-paper border border-line rounded-[14px] p-3.5 shadow-[0_12px_28px_rgba(18,61,21,0.12)] flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] bg-indigo-deep rounded-lg flex items-center justify-center">
              <TrendingUp className="w-[18px] h-[18px] text-ochre" />
            </div>
            <div>
              <p className="text-[10px] text-ink-soft m-0">Avg. member growth</p>
              <p className="font-mono text-[14px] text-ink m-0">+18.4%/yr</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Stats bar ═══ */}
      <section className="bg-indigo-deep flex flex-wrap justify-around py-8 px-6 text-center">
        <div>
          <p className="font-mono text-ochre text-[26px] m-0">50,000+</p>
          <p className="text-[11.5px] text-[#9FC79B] m-0 mt-1">Farmers &amp; members served</p>
        </div>
        <div>
          <p className="font-mono text-ochre text-[26px] m-0">₦2.5B+</p>
          <p className="text-[11.5px] text-[#9FC79B] m-0 mt-1">Saved through Agriqcap</p>
        </div>
        <div>
          <p className="font-mono text-ochre text-[26px] m-0">₦1.8B+</p>
          <p className="text-[11.5px] text-[#9FC79B] m-0 mt-1">Loaned to members</p>
        </div>
      </section>

      {/* ═══ Features grid ═══ */}
      <section id="features" className="py-14 px-6 md:px-10 max-w-[1180px] mx-auto">
        <div className="flex justify-between items-end mb-8 gap-6">
          <h2 className="font-display font-bold text-[26px] leading-[1.3] text-ink max-w-[640px]">
            Everything you need to save, borrow and grow with your{" "}
            <span className="text-indigo">cooperative</span> — nothing you don&apos;t.
          </h2>
          <span className="text-[12.5px] text-ink-soft whitespace-nowrap">Features</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Image card */}
          <div className="bg-indigo rounded-2xl p-5 flex items-end min-h-[180px]">
            <TrendingUp className="w-11 h-11 text-ochre" strokeWidth={1.6} />
          </div>
          {/* Feature cards */}
          <FeatureCard
            icon={Clock}
            title="Automated savings & interest"
            desc="Set a goal, save consistently, and watch interest post automatically — no manual tracking."
          />
          <FeatureCard
            icon={Users}
            title="Real cooperative governance"
            desc="Elections, committees and Esusu rotations, run transparently inside the app your members already use."
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
          <p className="text-loam text-[11.5px] font-semibold mb-2">Savings</p>
          <h3 className="font-display font-bold text-[23px] text-ink mb-3">
            Secure your future. Earn industry-leading rates.
          </h3>
          <p className="text-[13.5px] text-ink-soft leading-relaxed mb-5">
            Whether you&apos;re saving toward next season&apos;s inputs or building a long-term
            cooperative fund, Agriqcap&apos;s savings products are built around real agricultural
            cycles — not generic bank terms.
          </p>
          <ul className="space-y-2.5 list-none p-0 m-0">
            <CheckItem>Flexible Savings — withdraw anytime, 6.5% p.a.</CheckItem>
            <CheckItem>Harvest Lock Fixed Deposit — 90-day term, 11.2% p.a.</CheckItem>
            <CheckItem>Cooperative Growth Fund — pooled returns, 8.9% p.a.</CheckItem>
          </ul>
        </div>
        <div className="space-y-2.5">
          <LandingProductCard name="Harvest Lock" desc="90-day Fixed Deposit" rate="11.2%" />
          <LandingProductCard name="Cooperative Growth Fund" desc="Pooled cooperative returns" rate="8.9%" />
        </div>
      </section>

      {/* ═══ Loans detail ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-11 px-6 md:px-10 py-10 max-w-[1180px] mx-auto items-center">
        {/* Visual first on desktop (reversed) */}
        <div className="order-1 lg:order-1">
          <div className="bg-gradient-to-br from-indigo to-[#0F4A13] text-white rounded-2xl p-5">
            <p className="text-[12px] text-[#BFE0BE] mb-1">You could be eligible to borrow up to</p>
            <p className="font-mono text-[28px] font-medium mb-3">₦375,000</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[12.5px]">
                <span className="text-[#9FC79B]">Savings consistency</span>
                <span className="text-white">Excellent</span>
              </div>
              <div className="flex justify-between text-[12.5px]">
                <span className="text-[#9FC79B]">Cooperative participation</span>
                <span className="text-white">Active</span>
              </div>
            </div>
          </div>
        </div>
        <div className="order-2 lg:order-2">
          <p className="text-loam text-[11.5px] font-semibold mb-2">Loans</p>
          <h3 className="font-display font-bold text-[23px] text-ink mb-3">
            Affordable credit to fund your farming season.
          </h3>
          <p className="text-[13.5px] text-ink-soft leading-relaxed mb-5">
            Whether you&apos;re a single farmer or an aggregator sourcing for a cooperative,
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
        <div className="bg-gradient-to-br from-indigo to-[#0F4A13] rounded-[20px] p-9 text-white">
          <h3 className="font-display font-bold text-[22px] mb-7 text-center">
            Start in 3 easy steps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StepCard num="1" title="Sign up & verify" desc="Create your account and verify your identity in minutes, bank-grade secure." />
            <StepCard num="2" title="Save consistently" desc="Pick a savings product and start building your history — every deposit counts." />
            <StepCard num="3" title="Unlock more" desc="Access fair loans, join your cooperative, and grow through investment pools." />
          </div>
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <section id="contact" className="text-center py-14 px-6">
        <h2 className="font-display font-bold text-[28px] text-ink mb-3">
          Ready to grow with your cooperative?
        </h2>
        <p className="text-[14px] text-ink-soft mb-6">
          Join thousands of farmers and members already saving, borrowing and growing with Agriqcap.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-ochre text-ink font-semibold text-[14px] px-6 py-3 rounded-[10px] hover:opacity-90 transition"
        >
          Get started free
        </Link>
      </section>


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
            <p className="text-[11.5px] text-ink-soft">{desc}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[13px] text-loam">{rate}</p>
            <p className="text-[9.5px] text-ink-soft">p.a.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-ochre text-ink font-display font-bold text-[14px] flex items-center justify-center flex-shrink-0">
        {num}
      </div>
      <div>
        <h5 className="font-display font-semibold text-[15px] text-white mb-1">{title}</h5>
        <p className="text-[12px] text-[#BFE0BE] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
