'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* ─────────────────────────────────────────────
   Testimonial data
───────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    quote:
      "I used to keep my feed money in a kolo at home. With AgroEsusu I saved ₦180,000 in three months and bought a new feed mill before prices went up.",
    name: 'Amaka Eze',
    role: 'Poultry farmer, Enugu',
    initials: 'AE',
  },
  {
    quote:
      "Our cooperative had tried ajo for years but someone always delayed. The group esusu payout hit my account on the exact day — no drama, no follow-up.",
    name: 'Tunde Adeyemi',
    role: 'Cassava farmer, Oyo',
    initials: 'TA',
  },
  {
    quote:
      "I set up auto-save for ₦2,000 daily. By planting season I had enough for quality hybrid seeds and fertiliser without touching my main account.",
    name: 'Fatima Bello',
    role: 'Crop farmer, Kaduna',
    initials: 'FB',
  },
  {
    quote:
      "Our livestock group used the emergency fund when a flood hit. We raised ₦500,000 in 48 hours through majority vote — no bank would have done that.",
    name: 'Emeka Okafor',
    role: 'Livestock cooperative, Imo',
    initials: 'EO',
  },
];

/* ─────────────────────────────────────────────
   Star rating
───────────────────────────────────────────── */
function StarRating() {
  return (
    <div className="flex gap-0.5 mb-3">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.5l1.7 3.4 3.8.55-2.75 2.68.65 3.77L8 10l-3.4 1.9.65-3.77L2.5 5.45l3.8-.55L8 1.5z"
            fill="#F97316"
          />
        </svg>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Testimonial carousel panel
───────────────────────────────────────────── */
function TestimonialPanel() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const paused = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Check prefers-reduced-motion once on mount
  const [prefersReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const goTo = (next: number) => {
    if (next === activeRef.current) return;
    setVisible(false);
    setTimeout(() => {
      setActive(next);
      setVisible(true);
    }, 240);
  };

  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => {
      if (!paused.current) {
        goTo((activeRef.current + 1) % TESTIMONIALS.length);
      }
    }, 5500);
    return () => clearInterval(id);
  }, [prefersReduced]);

  const t = TESTIMONIALS[active];

  return (
    <div
      className="flex flex-col justify-center h-full px-10 py-16 select-none"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onFocus={() => { paused.current = true; }}
      onBlur={() => { paused.current = false; }}
    >
      {/* Static headline */}
      <div className="mb-10">
        <h2 className="text-[28px] font-bold leading-snug mb-3" style={{ color: '#ffffff' }}>
          Built for Nigerian agripreneurs who take savings seriously.
        </h2>
        <p className="text-[15px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Join thousands of farmers growing their money with group power.
        </p>
      </div>

      {/* Animated testimonial card */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '16px',
          padding: '28px 24px',
          opacity: prefersReduced ? 1 : visible ? 1 : 0,
          transform: prefersReduced ? 'none' : visible ? 'translateY(0)' : 'translateY(8px)',
          transition: prefersReduced ? 'none' : 'opacity 240ms ease, transform 240ms ease',
        }}
      >
        <StarRating />
        <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.88)' }}>
          &ldquo;{t.quote}&rdquo;
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: 'rgba(249,115,22,0.22)',
              color: '#F97316',
              border: '1px solid rgba(249,115,22,0.35)',
            }}
          >
            {t.initials}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>{t.name}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.48)' }}>{t.role}</p>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-2 mt-5">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to testimonial ${i + 1}`}
            style={{
              width: i === active ? '22px' : '8px',
              height: '8px',
              borderRadius: '99px',
              background: i === active ? '#F97316' : 'rgba(255,255,255,0.22)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: prefersReduced ? 'none' : 'all 280ms ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   AuthSplitShell — exported component
───────────────────────────────────────────── */
export function AuthSplitShell({
  heading,
  subtext,
  eyebrow,
  children,
}: {
  heading: string;
  subtext: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <>
      {/* Inject responsive CSS for right panel */}
      <style>{`
        .auth-split-root { display: flex; min-height: 100vh; background: #FAFAF7; }
        .auth-split-form { 
          flex: 1; display: flex; flex-direction: column; justify-content: center;
          overflow-y: auto; background: #ffffff;
          padding: 40px 28px;
        }
        .auth-split-brand { display: none; }
        @media (min-width: 900px) {
          .auth-split-form { padding: 60px 72px; max-width: 600px; }
          .auth-split-brand {
            display: flex; flex: 1;
            background: linear-gradient(160deg, #0F4A25 0%, #0B3D1F 55%, #072D16 100%);
            position: relative; overflow: hidden;
          }
        }
        .auth-input-custom {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1px solid var(--input-border, #D6D6C8);
          background: var(--input-bg, #ffffff);
          color: var(--text-primary, #2B2A24);
          font-size: 15px; outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .auth-input-custom:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.15);
        }
      `}</style>

      <div className="auth-split-root">

        {/* ── LEFT: Form panel ── */}
        <div className="auth-split-form">

          {/* Logo */}
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#F97316' }}
              >
                <span className="font-bold text-base" style={{ color: '#ffffff' }}>A</span>
              </div>
              <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary, #2B2A24)' }}>
                AgroEsusu
              </span>
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#F97316' }}>
                {eyebrow}
              </p>
            )}
            <h1 className="text-[28px] font-bold leading-tight mb-2" style={{ color: 'var(--text-primary, #2B2A24)' }}>
              {heading}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted, #8A8A7E)' }}>
              {subtext}
            </p>
          </div>

          {/* Children (form) */}
          <div style={{ maxWidth: '420px', width: '100%' }}>
            {children}
          </div>

          {/* Legal */}
          <p className="text-xs mt-8" style={{ color: 'var(--text-faint, #B0B0A2)' }}>
            By continuing, you agree to AgroEsusu&apos;s{' '}
            <a href="#" className="underline hover:no-underline" style={{ color: 'var(--text-muted, #8A8A7E)' }}>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="underline hover:no-underline" style={{ color: 'var(--text-muted, #8A8A7E)' }}>
              Privacy Policy
            </a>.
          </p>
        </div>

        {/* ── RIGHT: Brand panel ── */}
        <div className="auth-split-brand">
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: '-120px', right: '-120px',
            width: '380px', height: '380px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '-80px', left: '-80px',
            width: '280px', height: '280px', borderRadius: '50%',
            background: 'rgba(249,115,22,0.07)', pointerEvents: 'none',
          }} />
          <TestimonialPanel />
        </div>

      </div>
    </>
  );
}
