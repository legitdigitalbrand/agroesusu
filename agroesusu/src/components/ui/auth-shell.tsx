import { ReactNode } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export function AuthShell({
  eyebrow,
  heading,
  subtext,
  children,
  wide,
}: {
  eyebrow?: string;
  heading: string;
  subtext: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative"
      style={{ background: 'var(--surface-base)' }}
    >
      <div className="absolute top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      <div className={`w-full ${wide ? 'max-w-[440px]' : 'max-w-[420px]'}`}>
        <div
          className="rounded-2xl border overflow-y-auto max-h-[88vh]"
          style={{
            background: 'var(--surface-card)',
            borderColor: 'var(--border-default)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.12)',
            padding: '44px 40px',
          }}
        >
          {/* Wordmark */}
          <div className="flex justify-center mb-7">
            <Link href="/" className="inline-flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ background: 'var(--accent)' }}
              >
                <span className="font-bold text-base" style={{ color: 'var(--qa-primary-text)' }}>A</span>
              </div>
              <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                AgroEsusu
              </span>
            </Link>
          </div>

          <div className="text-center mb-8">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--accent)' }}>
                {eyebrow}
              </p>
            )}
            <h1 className="text-[26px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {heading}
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              {subtext}
            </p>
          </div>

          {children}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-faint)' }}>
          By continuing, you agree to AgroEsusu&apos;s{' '}
          <a href="#" className="underline hover:no-underline">Terms of Service</a> and{' '}
          <a href="#" className="underline hover:no-underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
      <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
    </div>
  );
}
