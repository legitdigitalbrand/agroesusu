import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// LogoMark — two-tone logo (outer ring + inner dot)
// Variant: 'customer' (indigo ring + ochre dot) | 'admin' (light ring + sage dot)
// ──────────────────────────────────────────────

interface LogoMarkProps {
  size?: number;
  variant?: "customer" | "admin";
  className?: string;
}

export function LogoMark({ size = 40, variant = "customer", className }: LogoMarkProps) {
  const ringColor = variant === "customer" ? "#1B5E20" : "#F5F1E8";
  const dotColor = variant === "customer" ? "#BBDC12" : "#3E8E2F";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Yield logo"
    >
      <circle cx="24" cy="24" r="20" stroke={ringColor} strokeWidth="3" fill="none" />
      <circle cx="24" cy="24" r="6" fill={dotColor} />
    </svg>
  );
}

// ──────────────────────────────────────────────
// StampIcon — circular "passbook stamp" (checkmark in a ring)
// Used on every confirmed transaction row
// ──────────────────────────────────────────────

interface StampIconProps {
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
      className={className}
      aria-label="Confirmed"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M8 12.5l3 3l5-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────
// ProgressRing — concentric progress for savings goals
// Uses --track behind --ochre
// ──────────────────────────────────────────────

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8E4D9"
          strokeWidth={strokeWidth}
        />
        {/* Progress (ochre) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#BBDC12"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && (
            <span className="font-mono text-lg font-semibold text-ink">{label}</span>
          )}
          {sublabel && (
            <span className="text-xs text-ink-soft">{sublabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Button variants
// ──────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "loam" | "dark" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  const variants = {
    primary: "ys-btn-primary",
    loam: "ys-btn-loam",
    dark: "ys-btn-dark",
    ghost: "ys-btn-ghost",
  };
  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-3.5 text-base",
  };
  return (
    <button className={cn(variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────
// MoneyText — formatted Naira in mono, with optional direction
// ──────────────────────────────────────────────

interface MoneyTextProps {
  amount: number;
  direction?: "credit" | "debit" | "neutral";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function MoneyText({ amount, direction = "neutral", size = "md", className }: MoneyTextProps) {
  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const prefix = direction === "debit" ? "−" : direction === "credit" ? "+" : "";
  const colorClass = direction === "credit" ? "text-loam" : direction === "debit" ? "text-clay" : "text-ink";
  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
  }[size];

  return (
    <span className={cn("font-mono tabular-nums", colorClass, sizeClass, className)}>
      {prefix}{formatted}
    </span>
  );
}

// ──────────────────────────────────────────────
// StatusBadge — colored pill for loan/savings/investment status
// ──────────────────────────────────────────────

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusMap: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-loam/10", text: "text-loam", label: "Active" },
    pending: { bg: "bg-ochre/15", text: "text-indigo", label: "Pending" },
    approved: { bg: "bg-loam/10", text: "text-loam", label: "Approved" },
    denied: { bg: "bg-clay/10", text: "text-clay", label: "Denied" },
    disbursed: { bg: "bg-loam/10", text: "text-loam", label: "Disbursed" },
    overdue: { bg: "bg-clay/10", text: "text-clay", label: "Overdue" },
    defaulted: { bg: "bg-clay/10", text: "text-clay", label: "Defaulted" },
    locked: { bg: "bg-indigo/10", text: "text-indigo", label: "Locked" },
    matured: { bg: "bg-loam/10", text: "text-loam", label: "Matured" },
    redeemed: { bg: "bg-indigo/10", text: "text-indigo", label: "Redeemed" },
    completed: { bg: "bg-loam/10", text: "text-loam", label: "Completed" },
  };

  const config = statusMap[status] || { bg: "bg-parchment", text: "text-ink-soft", label: status };

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", config.bg, config.text, className)}>
      {config.label}
    </span>
  );
}

// ──────────────────────────────────────────────
// Card — base surface
// ──────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "light" | "dark";
}

export function Card({ variant = "light", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(variant === "dark" ? "ys-card-dark" : "ys-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────
// ScreenHeader — serif title + optional subtitle for mobile screens
// ──────────────────────────────────────────────

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ScreenHeader({ title, subtitle, action, className }: ScreenHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div>
        <h1 className="font-serif text-2xl text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-soft mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────
// LoadingState / ErrorState / EmptyState
// ──────────────────────────────────────────────

export function LoadingState({ message = "Loading…", className }: { message?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-track border-t-indigo" />
      <p className="mt-3 text-sm text-ink-soft">{message}</p>
    </div>
  );
}

export function ErrorState({ message = "Something went wrong", onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <p className="text-sm text-clay">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 ys-btn-ghost text-sm">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message, action, className }: { title: string; message?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <h3 className="font-serif text-lg text-ink">{title}</h3>
      {message && <p className="mt-1 text-sm text-ink-soft max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
