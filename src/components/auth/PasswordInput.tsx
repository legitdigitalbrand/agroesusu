"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  hintHref?: string;
  onHintClick?: () => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, hint, hintHref, onHintClick, className = "", ...props }, ref) => {
    const [show, setShow] = useState(false);

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
        <div className="relative">
          <input
            ref={ref}
            type={show ? "text" : "password"}
            className="auth-input pr-11"
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition"
            tabIndex={-1}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
