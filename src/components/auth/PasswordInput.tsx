"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  hintHref?: string;
  onHintClick?: () => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, hint, hintHref, onHintClick, className = "", id: propId, ...props }, ref) => {
    const [show, setShow] = useState(false);
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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={show ? "text" : "password"}
            className="auth-input pr-11 focus:ring-2 focus:ring-loam focus:border-loam focus:outline-none transition"
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-ink-soft hover:text-ink transition rounded focus:outline-none focus:ring-2 focus:ring-loam"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
