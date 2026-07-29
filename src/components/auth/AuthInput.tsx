"use client";

import { forwardRef } from "react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  hintHref?: string;
  onHintClick?: () => void;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, hint, hintHref, onHintClick, className = "", ...props }, ref) => {
    return (
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {label}
          </label>
          {hint && (
            <a
              href={hintHref}
              onClick={onHintClick}
              className="text-[12px] text-loam font-medium hover:text-indigo transition"
            >
              {hint}
            </a>
          )}
        </div>
        <input
          ref={ref}
          className="auth-input"
          {...props}
        />
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
