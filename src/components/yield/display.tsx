"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ──────────────────────────────────────────────
// LogoMark — two-tone logo (outer ring + inner dot)
// Variant: 'customer' (indigo ring + ochre dot) | 'admin' (light ring + sage dot)
// ──────────────────────────────────────────────

export interface LogoMarkProps {
  size?: number;
  variant?: "customer" | "admin";
  className?: string;
}

export function LogoMark({ size = 40, variant = "customer", className }: LogoMarkProps) {
  const ringColor = variant === "customer" ? "#1B5E20" : "#E8F5E9";
  const dotColor = variant === "customer" ? "#BBDC12" : "#3E8E2F";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0 transition-transform hover:scale-105 duration-200", className)}
      aria-label="Agriqcap logo"
    >
      <circle cx="24" cy="24" r="20" stroke={ringColor} strokeWidth="3.5" fill="none" />
      <circle cx="24" cy="24" r="6.5" fill={dotColor} />
    </svg>
  );
}

// ──────────────────────────────────────────────
// StampIcon — circular "passbook stamp" (checkmark in a ring)
// Used on every confirmed transaction row
// ──────────────────────────────────────────────

export interface StampIconProps {
  size?: number;
  className?: string;
}

export function StampIcon({ size = 20, className }: StampIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      aria-label="Confirmed"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M8 12.5l3 3l5-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────
// ProgressRing — concentric progress for savings goals
// Uses track token behind ochre/indigo fill
// ──────────────────────────────────────────────

export interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  variant?: "ochre" | "indigo" | "loam";
  className?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  variant = "ochre",
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const colorMap = {
    ochre: "#BBDC12",
    indigo: "#1B5E20",
    loam: "#3E8E2F",
  };

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#D9E9D2"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorMap[variant]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          {label && (
            <span className="font-mono text-base sm:text-lg font-semibold text-ink leading-none">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[11px] sm:text-xs text-ink-soft mt-1 font-medium">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// MoneyText — formatted Naira in mono, with optional direction
// ──────────────────────────────────────────────

export interface MoneyTextProps {
  amount: number;
  direction?: "credit" | "debit" | "neutral";
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
}

export function MoneyText({
  amount,
  direction = "neutral",
  size = "md",
  className,
}: MoneyTextProps) {
  // Format number separately — NOT using Intl currency style (which produces
  // ₦ inline and triggers font fallback issues with IBM Plex Mono)
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const prefix = direction === "debit" ? "−" : direction === "credit" ? "+" : "";
  const colorClass =
    direction === "credit" ? "text-loam" : direction === "debit" ? "text-clay" : "";  // neutral inherits parent color

  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
    "2xl": "text-3xl",
    "3xl": "text-4xl",
  }[size];

  return (
    <span
      className={cn("inline-flex items-baseline gap-0.5 font-mono tabular-nums tracking-normal font-semibold", colorClass, sizeClass, className)}
    >
      {prefix && <span>{prefix}</span>}
      <span className="naira-symbol" aria-hidden="true">₦</span>
      <span>{formatted}</span>
    </span>
  );
}

// ──────────────────────────────────────────────
// ScreenHeader — display title + optional subtitle & actions
// ──────────────────────────────────────────────

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  backButton?: React.ReactNode;
  className?: string;
}

export function ScreenHeader({
  title,
  subtitle,
  action,
  badge,
  backButton,
  className,
}: ScreenHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2", className)}>
      <div className="flex items-start gap-3">
        {backButton && <div className="mt-1 shrink-0">{backButton}</div>}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl text-ink font-semibold tracking-tight leading-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-sm text-ink-soft mt-1 leading-relaxed max-w-2xl font-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────
// LoadingState / ErrorState / EmptyState
// ──────────────────────────────────────────────

export function LoadingState({
  message = "Loading…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="relative flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-track border-t-indigo" />
        <div className="absolute h-5 w-5 rounded-full bg-ochre/40 animate-ping" />
      </div>
      <p className="mt-4 text-sm font-medium text-ink-soft animate-pulse">{message}</p>
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center max-w-md mx-auto", className)}>
      <div className="w-12 h-12 rounded-2xl bg-clay-light/80 border border-clay/20 text-clay flex items-center justify-center mb-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-clay leading-snug">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm" className="mt-4 text-clay hover:bg-clay-light/50">
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
  className,
}: {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-14 px-4 text-center max-w-md mx-auto", className)}>
      <div className="w-12 h-12 rounded-2xl bg-parchment border border-line text-ink-soft flex items-center justify-center mb-3.5 shadow-2xs">
        {icon || (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        )}
      </div>
      <h3 className="font-display text-lg font-semibold text-ink leading-tight">{title}</h3>
      {message && <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
