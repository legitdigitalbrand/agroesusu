"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  hintHref?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, hint, hintHref, className = "", ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {label}
          </label>
          {hint && (
            <a href={hintHref} className="text-[12px] text-loam font-medium hover:text-indigo transition">
              {hint}
            </a>
          )}
        </div>
        <div className="relative">
          <input
            ref={ref}
            type={show ? "text" : "password"}
            className="auth-input pr-10 font-mono tracking-[0.06em]"
            style={{ fontFamily: show ? "'IBM Plex Sans', sans-serif" : undefined }}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition"
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
