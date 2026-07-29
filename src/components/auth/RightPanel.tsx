"use client";

import { motion } from "framer-motion";
import { FloatingCard, StatsCard, TestimonialCard, FeaturePill, MemberCount } from "./FloatingCards";

// ── Login right panel: product data cards ──
export function LoginRightPanel() {
  return (
    <div
      className="relative h-full w-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #1B5E20 0%, #123D15 100%)",
        borderRadius: "0 24px 24px 0",
      }}
    >
      {/* Ambient circles */}
      <div
        className="absolute rounded-full"
        style={{
          width: "240px",
          height: "240px",
          background: "rgba(187, 220, 18, 0.08)",
          top: "-70px",
          right: "-70px",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "160px",
          height: "160px",
          background: "rgba(255,255,255,0.04)",
          bottom: "-50px",
          left: "-40px",
        }}
      />

      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="font-display text-[18px] font-bold text-white text-center leading-relaxed mb-10 relative z-20 px-8"
      >
        Save smarter.<br />
        <span className="text-ochre">Grow together.</span>
      </motion.div>

      {/* Layered floating cards — offset, rotated, varied z-index */}
      <div className="flex flex-col items-center gap-5 relative">
        {/* Balance card — slightly right, rotated +1.5°, highest z */}
        <FloatingCard
          label="Available Balance"
          value="₦134,000"
          badge="+11.2% p.a."
          delay={0.2}
          rotate={1.5}
          offsetX={24}
          zIndex={30}
        />

        {/* Loan card — left, rotated -2°, mid z */}
        <StatsCard
          label="Loan limit"
          value="₦402,000"
          bars={[
            { height: 10 },
            { height: 16 },
            { height: 24, active: true },
            { height: 20 },
            { height: 30, active: true },
            { height: 22 },
          ]}
          delay={0.35}
          rotate={-2}
          offsetX={-16}
          zIndex={20}
        />

        {/* Testimonial — right, rotated +1°, lowest z */}
        <TestimonialCard
          text='"My Esusu group helped me expand my farm. I got my payout in 3 days."'
          author="— Musa A., Kano · Member since 2024"
          delay={0.5}
          rotate={1}
          offsetX={20}
          zIndex={10}
        />
      </div>
    </div>
  );
}

// ── Signup right panel: value props ──
export function SignupRightPanel() {
  return (
    <div
      className="relative h-full w-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #1B5E20 0%, #123D15 100%)",
        borderRadius: "0 24px 24px 0",
      }}
    >
      {/* Ambient circles */}
      <div
        className="absolute rounded-full"
        style={{
          width: "240px",
          height: "240px",
          background: "rgba(187, 220, 18, 0.08)",
          top: "-70px",
          right: "-70px",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "160px",
          height: "160px",
          background: "rgba(255,255,255,0.04)",
          bottom: "-50px",
          left: "-40px",
        }}
      />

      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="font-display text-[18px] font-bold text-white text-center leading-relaxed mb-10 relative z-20 px-8"
      >
        Join thousands<br />
        <span className="text-ochre">growing their wealth.</span>
      </motion.div>

      {/* Feature pills — stacked with spacing */}
      <div className="flex flex-col gap-3 relative z-20 items-center">
        <FeaturePill
          icon={<SavingsIcon />}
          title="Savings rate"
          subtitle="Up to 12% p.a. — fixed"
          delay={0.2}
        />
        <FeaturePill
          icon={<LoanIcon />}
          title="Cooperative loans"
          subtitle="Up to 3× your savings"
          delay={0.3}
        />
        <FeaturePill
          icon={<InvestIcon />}
          title="Investments"
          subtitle="Agri-pools from ₦10,000"
          delay={0.4}
        />
      </div>

      {/* Member count */}
      <div className="mt-10 relative z-20">
        <MemberCount count="50,000+" label="active members" delay={0.55} />
      </div>
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
