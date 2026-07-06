'use client';

import { InputHTMLAttributes, ReactNode, useState, forwardRef } from 'react';

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  rightElement?: ReactNode;
  labelExtra?: ReactNode;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, hint, rightElement, labelExtra, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
          {labelExtra}
        </div>
        <div className="relative">
          <input
            ref={ref}
            {...props}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            className={`w-full px-4 py-3 rounded-xl border outline-none transition-all duration-150 text-[15px] ${
              rightElement ? 'pr-11' : ''
            } ${className || ''}`}
            style={{
              background: 'var(--input-bg)',
              borderColor: error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--input-border)',
              color: 'var(--text-primary)',
              boxShadow: error
                ? '0 0 0 3px rgba(220,38,38,0.08)'
                : focused
                ? '0 0 0 3px var(--accent-subtle)'
                : 'none',
            }}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">{rightElement}</div>
          )}
        </div>
        {error ? (
          <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

AuthInput.displayName = 'AuthInput';
