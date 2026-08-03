"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  showDot?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  showDot = true,
  size = "md",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim();

  const statusMap: Record<
    string,
    { bg: string; text: string; dot: string; border: string; label: string }
  > = {
    // Success / Positive
    active: { bg: "bg-loam-light/70", text: "text-loam", dot: "bg-loam", border: "border-loam/25", label: "Active" },
    approved: { bg: "bg-loam-light/70", text: "text-loam", dot: "bg-loam", border: "border-loam/25", label: "Approved" },
    disbursed: { bg: "bg-loam-light/70", text: "text-loam", dot: "bg-loam", border: "border-loam/25", label: "Disbursed" },
    matured: { bg: "bg-loam-light/70", text: "text-loam", dot: "bg-loam", border: "border-loam/25", label: "Matured" },
    completed: { bg: "bg-loam-light/70", text: "text-loam", dot: "bg-loam", border: "border-loam/25", label: "Completed" },
    success: { bg: "bg-loam-light/70", text: "text-loam", dot: "bg-loam", border: "border-loam/25", label: "Success" },

    // Warning / Pending / Review
    pending: { bg: "bg-ochre-light/90", text: "text-indigo-deep", dot: "bg-ochre-dim", border: "border-ochre/40", label: "Pending" },
    processing: { bg: "bg-ochre-light/90", text: "text-indigo-deep", dot: "bg-ochre-dim", border: "border-ochre/40", label: "Processing" },
    review: { bg: "bg-ochre-light/90", text: "text-indigo-deep", dot: "bg-ochre-dim", border: "border-ochre/40", label: "Under Review" },
    warning: { bg: "bg-ochre-light/90", text: "text-indigo-deep", dot: "bg-ochre-dim", border: "border-ochre/40", label: "Warning" },

    // Error / Destructive
    denied: { bg: "bg-clay-light/70", text: "text-clay", dot: "bg-clay", border: "border-clay/25", label: "Denied" },
    overdue: { bg: "bg-clay-light/70", text: "text-clay", dot: "bg-clay", border: "border-clay/25", label: "Overdue" },
    defaulted: { bg: "bg-clay-light/70", text: "text-clay", dot: "bg-clay", border: "border-clay/25", label: "Defaulted" },
    failed: { bg: "bg-clay-light/70", text: "text-clay", dot: "bg-clay", border: "border-clay/25", label: "Failed" },
    rejected: { bg: "bg-clay-light/70", text: "text-clay", dot: "bg-clay", border: "border-clay/25", label: "Rejected" },
    error: { bg: "bg-clay-light/70", text: "text-clay", dot: "bg-clay", border: "border-clay/25", label: "Error" },

    // Neutral / Informational
    locked: { bg: "bg-track/50", text: "text-indigo", dot: "bg-indigo", border: "border-line", label: "Locked" },
    redeemed: { bg: "bg-track/50", text: "text-indigo", dot: "bg-indigo", border: "border-line", label: "Redeemed" },
    archived: { bg: "bg-track/40", text: "text-ink-soft", dot: "bg-ink-soft", border: "border-line", label: "Archived" },
    draft: { bg: "bg-track/40", text: "text-ink-soft", dot: "bg-ink-soft", border: "border-line", label: "Draft" },
    inactive: { bg: "bg-track/40", text: "text-ink-soft", dot: "bg-ink-soft", border: "border-line", label: "Inactive" },
    closed: { bg: "bg-track/40", text: "text-ink-soft", dot: "bg-ink-soft", border: "border-line", label: "Closed" },
  };

  const defaultConfig = {
    bg: "bg-parchment",
    text: "text-ink-soft",
    dot: "bg-ink-soft",
    border: "border-line",
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown",
  };

  const config = statusMap[normalized] || defaultConfig;
  const displayLabel = children || config.label;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] font-medium gap-1",
    md: "px-2.5 py-1 text-xs font-semibold gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border transition-colors select-none",
        config.bg,
        config.text,
        config.border,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5",
            config.dot
          )}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
