"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "loam" | "dark" | "ghost" | "outline" | "destructive" | "clay";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      primary: "bg-indigo text-white hover:bg-indigo-deep active:scale-[0.98] shadow-xs border border-transparent",
      secondary: "bg-ochre text-indigo-deep hover:bg-ochre-dim active:scale-[0.98] shadow-xs border border-transparent font-semibold",
      loam: "bg-loam text-white hover:bg-loam-dim active:scale-[0.98] shadow-xs border border-transparent",
      dark: "bg-indigo-deep text-white hover:bg-indigo active:scale-[0.98] shadow-xs border border-transparent",
      ghost: "bg-transparent text-ink-soft hover:bg-parchment hover:text-ink active:bg-track/40 border border-transparent",
      outline: "bg-paper border border-line text-ink hover:bg-parchment hover:border-line/80 active:bg-track/30 shadow-2xs",
      destructive: "bg-clay text-white hover:bg-clay-dim active:scale-[0.98] shadow-xs border border-transparent",
      clay: "bg-clay text-white hover:bg-clay-dim active:scale-[0.98] shadow-xs border border-transparent",
    };

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "px-3.5 py-1.5 text-xs font-semibold rounded-lg gap-1.5 min-h-[34px]",
      md: "px-5 py-2.5 text-sm font-semibold rounded-xl gap-2 min-h-[44px]",
      lg: "px-6 py-3.5 text-base font-semibold rounded-xl gap-2.5 min-h-[52px]",
    };

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment",
          "disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none",
          fullWidth && "w-full",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4 shrink-0 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon && <span className="shrink-0 inline-flex items-center">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="shrink-0 inline-flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
