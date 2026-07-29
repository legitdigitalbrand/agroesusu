"use client";

import { motion } from "framer-motion";

// ── Floating glassmorphism card ──
export function FloatingCard({
  label,
  value,
  badge,
  delay = 0,
  rotate = 0,
  offsetX = 0,
  zIndex = 10,
}: {
  label: string;
  value: string;
  badge?: string;
  delay?: number;
  rotate?: number;
  offsetX?: number;
  zIndex?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotate - 2 }}
      animate={{
        opacity: 1,
        y: [0, -8, 0],
        rotate,
      }}
      transition={{
        opacity: { duration: 0.5, delay, ease: "easeOut" },
        rotate: { duration: 0.5, delay, ease: "easeOut" },
        y: {
          duration: 4,
          delay: delay + 0.5,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
      style={{
        transform: `translateX(${offsetX}px)`,
        zIndex,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
      }}
      className="rounded-2xl p-5 backdrop-blur-xl bg-white/10 border border-white/20 w-full max-w-[210px] relative"
    >
      {/* Subtle reflection gradient */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)",
        }}
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/55 mb-1 relative">
        {label}
      </div>
      <div className="font-mono text-[22px] font-semibold text-white mb-3 relative">
        {value}
      </div>
      {badge && (
        <div className="inline-flex items-center gap-1.5 bg-ochre/20 rounded-full px-2.5 py-1 relative">
          <div className="w-1.5 h-1.5 rounded-full bg-ochre" />
          <span className="font-mono text-[10px] font-semibold text-ochre">
            {badge}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ── Ochre stat card with mini bar chart ──
export function StatsCard({
  label,
  value,
  bars,
  delay = 0,
  rotate = 0,
  offsetX = 0,
  zIndex = 10,
}: {
  label: string;
  value: string;
  bars: { height: number; active?: boolean }[];
  delay?: number;
  rotate?: number;
  offsetX?: number;
  zIndex?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotate - 2 }}
      animate={{
        opacity: 1,
        y: [0, -6, 0],
        rotate,
      }}
      transition={{
        opacity: { duration: 0.5, delay, ease: "easeOut" },
        rotate: { duration: 0.5, delay, ease: "easeOut" },
        y: {
          duration: 3.5,
          delay: delay + 0.5,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
      style={{
        transform: `translateX(${offsetX}px)`,
        zIndex,
        boxShadow: "0 6px 24px rgba(18,61,21,0.15)",
      }}
      className="rounded-xl p-3.5 bg-ochre w-full max-w-[160px] relative"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-indigo-deep/65 mb-0.5">
        {label}
      </div>
      <div className="font-mono text-[17px] font-bold text-indigo-deep mb-2">
        {value}
      </div>
      <div className="flex items-end gap-[3px] h-8">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="w-2 rounded-t-[3px] rounded-b-none"
            style={{
              height: `${bar.height}px`,
              background: bar.active ? "#123D15" : "rgba(18,61,21,0.25)",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Testimonial pill ──
export function TestimonialCard({
  text,
  author,
  delay = 0,
  rotate = 0,
  offsetX = 0,
  zIndex = 10,
}: {
  text: string;
  author: string;
  delay?: number;
  rotate?: number;
  offsetX?: number;
  zIndex?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotate - 1 }}
      animate={{
        opacity: 1,
        y: [0, -5, 0],
        rotate,
      }}
      transition={{
        opacity: { duration: 0.5, delay, ease: "easeOut" },
        rotate: { duration: 0.5, delay, ease: "easeOut" },
        y: {
          duration: 5,
          delay: delay + 0.5,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
      style={{
        transform: `translateX(${offsetX}px)`,
        zIndex,
        boxShadow: "0 6px 20px rgba(0,0,0,0.10)",
      }}
      className="rounded-xl p-3.5 backdrop-blur-xl bg-white/10 border border-white/15 w-full max-w-[200px] relative"
    >
      <p className="text-[11px] text-white/80 leading-relaxed italic mb-2">
        {text}
      </p>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white/50">
        {author}
      </p>
    </motion.div>
  );
}

// ── Feature pill for signup right panel ──
export function FeaturePill({
  icon,
  title,
  subtitle,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="flex items-center gap-3 rounded-xl p-3 bg-white/8 border border-white/12 w-full max-w-[220px]"
    >
      <div className="w-8 h-8 rounded-lg bg-ochre flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-display text-[12px] font-bold text-white">{title}</div>
        <div className="text-[10px] text-white/50">{subtitle}</div>
      </div>
    </motion.div>
  );
}

// ── Member count stat ──
export function MemberCount({
  count,
  label,
  delay = 0,
}: {
  count: string;
  label: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="text-center relative z-10"
    >
      <div className="font-mono text-[20px] font-bold text-ochre">{count}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-white/50 mt-0.5">
        {label}
      </div>
    </motion.div>
  );
}
