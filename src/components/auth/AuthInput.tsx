"use client";

import { forwardRef, useId } from "react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  hintHref?: string;
  onHintClick?: () => void;
  /** Validation error — shows a clay/red border + message under the field. */
  error?: string | null;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, hint, hintHref, onHintClick, error, className = "", id: propId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = propId || generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <label htmlFor={inputId} className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {label}
          </label>
          {hint && (
            <a
              href={hintHref}
              onClick={onHintClick}
              className="text-[12px] text-loam-dim font-medium hover:text-indigo transition py-1"
            >
              {hint}
            </a>
          )}
        </div>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="auth-input focus:ring-2 focus:ring-loam focus:border-loam focus:outline-none transition"
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-[12px] font-medium text-clay">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
