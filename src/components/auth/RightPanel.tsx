"use client";

import { motion } from "framer-motion";
import { FloatingCard, StatsCard, TestimonialCard, FeaturePill, MemberCount } from "./FloatingCards";

// ── Login right panel: product data cards ──
export function LoginRightPanel() {
  return (
    <div className="relative h-full flex flex-col items-center justify-center p-7 overflow-hidden bg-gradient-to-br from-indigo to-indigo-deep">
      {/* Ambient circles */}
      <div className="absolute w-[200px] h-[200px] rounded-full bg-ochre/8 -top-15 -right-15" />
      <div className="absolute w-[140px] h-[140px] rounded-full bg-white/4 -bottom-10 -left-8" />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="font-display text-[15px] font-bold text-white text-center leading-snug mb-5 relative z-10"
      >
        Save smarter.<br />
        <span className="text-ochre">Grow together.</span>
      </motion.div>

      <FloatingCard
        label="Available Balance"
        value="₦134,000"
        badge="+11.2% p.a."
        delay={0.15}
        offset
      />

      <StatsCard
        label="Loan limit"
        value="₦402,000"
        bars={[
          { height: 8 },
          { height: 14 },
          { height: 22, active: true },
          { height: 18 },
          { height: 28, active: true },
          { height: 20 },
        ]}
        delay={0.3}
      />

      <TestimonialCard
        text='"My Esusu group helped me expand my farm. I got my payout in 3 days."'
        author="— Musa A., Kano · Member since 2024"
        delay={0.45}
      />
    </div>
  );
}

// ── Signup right panel: value props ──
export function SignupRightPanel() {
  return (
    <div className="relative h-full flex flex-col items-center justify-center p-7 overflow-hidden bg-gradient-to-br from-indigo to-indigo-deep">
      <div className="absolute w-[200px] h-[200px] rounded-full bg-ochre/8 -top-15 -right-15" />
      <div className="absolute w-[140px] h-[140px] rounded-full bg-white/4 -bottom-10 -left-8" />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="font-display text-[15px] font-bold text-white text-center leading-snug mb-5 relative z-10"
      >
        Join thousands<br />
        <span className="text-ochre">growing their wealth.</span>
      </motion.div>

      <div className="flex flex-col gap-2.5 relative z-10">
        <FeaturePill
          icon={<SavingsIcon />}
          title="Savings rate"
          subtitle="Up to 12% p.a. — fixed"
          delay={0.15}
        />
        <FeaturePill
          icon={<LoanIcon />}
          title="Cooperative loans"
          subtitle="Up to 3× your savings"
          delay={0.25}
        />
        <FeaturePill
          icon={<InvestIcon />}
          title="Investments"
          subtitle="Agri-pools from ₦10,000"
          delay={0.35}
        />
      </div>

      <MemberCount count="50,000+" label="active members" delay={0.5} />
    </div>
  );
}

// ── SVG icons ──
function SavingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M4 5h5a1.5 1.5 0 010 3H6" stroke="#123D15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="#123D15" strokeWidth="1.5" />
      <path d="M7 4v3l2 1" stroke="#123D15" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function InvestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 10l3-3 2.5 2.5L11 4" stroke="#123D15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
