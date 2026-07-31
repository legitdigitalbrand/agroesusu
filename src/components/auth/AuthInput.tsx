"use client";

import { forwardRef, useId } from "react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  hintHref?: string;
  onHintClick?: () => void;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, hint, hintHref, onHintClick, className = "", id: propId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = propId || generatedId;

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
          className="auth-input focus:ring-2 focus:ring-loam focus:border-loam focus:outline-none transition"
          {...props}
        />
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
