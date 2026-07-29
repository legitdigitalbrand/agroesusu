"use client";

import { motion } from "framer-motion";

// ── Floating glassmorphism card ──
export function FloatingCard({
  label,
  value,
  badge,
  delay = 0,
  offset = false,
}: {
  label: string;
  value: string;
  badge?: string;
  delay?: number;
  offset?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: offset ? 10 : 0 }}
      animate={{ opacity: 1, y: 0, x: offset ? 16 : 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="w-full max-w-[190px] rounded-2xl p-4 backdrop-blur-md bg-white/10 border border-white/18 relative z-10 mb-2.5"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/55 mb-0.5">
        {label}
      </div>
      <div className="font-mono text-[20px] font-semibold text-white mb-2.5">
        {value}
      </div>
      {badge && (
        <div className="inline-flex items-center gap-1 bg-ochre/20 rounded-full px-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-ochre" />
          <span className="font-mono text-[10px] font-semibold text-ochre">{badge}</span>
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
}: {
  label: string;
  value: string;
  bars: { height: number; active?: boolean }[];
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: -10 }}
      animate={{ opacity: 1, y: 0, x: -10 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="w-full max-w-[140px] rounded-xl p-2.5 bg-ochre relative z-10 mb-4"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-indigo-deep/65">
        {label}
      </div>
      <div className="font-mono text-[16px] font-bold text-indigo-deep">
        {value}
      </div>
      <div className="flex items-end gap-[3px] h-7 mt-1.5">
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
}: {
  text: string;
  author: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="w-full max-w-[190px] rounded-xl p-2.5 backdrop-blur-md bg-white/10 border border-white/15 relative z-10"
    >
      <p className="text-[11px] text-white/80 leading-relaxed italic mb-1.5">
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
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="flex items-center gap-2.5 rounded-xl p-2.5 bg-white/8 border border-white/12 w-full max-w-[200px]"
    >
      <div className="w-7 h-7 rounded-lg bg-ochre flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-display text-[11px] font-bold text-white">{title}</div>
        <div className="text-[10px] text-white/50">{subtitle}</div>
      </div>
    </motion.div>
  );
}

// ── Member count stat ──
export function MemberCount({ count, label, delay = 0 }: { count: string; label: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="text-center relative z-10 mt-1.5"
    >
      <div className="font-mono text-[18px] font-bold text-ochre">{count}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-white/50">
        {label}
      </div>
    </motion.div>
  );
}
