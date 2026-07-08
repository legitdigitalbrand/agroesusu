'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'outline';
  children: ReactNode;
}

export function AuthButton({ loading, variant = 'primary', children, disabled, className, ...props }: AuthButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`w-full py-3.5 rounded-xl font-semibold text-[15px] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${className || ''}`}
      style={
        isPrimary
          ? { background: 'var(--qa-primary-bg)', color: 'var(--qa-primary-text)' }
          : { background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
      }
      onMouseEnter={(e) => {
        if (disabled || loading) return;
        (e.currentTarget as HTMLButtonElement).style.background = isPrimary
          ? 'var(--qa-primary-bg)'
          : 'var(--surface-card-hover)';
        if (isPrimary) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.95)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = isPrimary ? 'var(--qa-primary-bg)' : 'var(--surface-card)';
        (e.currentTarget as HTMLButtonElement).style.filter = 'none';
      }}
    >
      {loading && (
        <span
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{
            borderColor: isPrimary ? 'rgba(31,42,5,0.25)' : 'var(--border-strong)',
            borderTopColor: isPrimary ? 'var(--qa-primary-text)' : 'var(--accent)',
          }}
        />
      )}
      {children}
    </button>
  );
}
