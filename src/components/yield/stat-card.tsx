"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export interface TrendProps {
  value: string | number;
  isPositive?: boolean;
  label?: string;
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: React.ReactNode | string | number;
  subtitle?: string;
  trend?: TrendProps;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: "default" | "flat" | "dark" | "ochre";
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  action,
  badge,
  variant = "default",
  className,
  ...props
}: StatCardProps) {
  const isDark = variant === "dark";

  return (
    <Card
      variant={isDark ? "dark" : variant === "flat" ? "flat" : "elevated"}
      padding="md"
      className={cn(
        "relative flex flex-col justify-between transition-all duration-200 min-w-0",
        variant === "ochre" && "bg-ochre-light/50 border border-ochre/30 text-indigo-deep",
        className
      )}
      {...props}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && (
            <div
              className={cn(
                "p-2 rounded-xl shrink-0 flex items-center justify-center",
                isDark
                  ? "bg-white/10 text-white"
                  : "bg-parchment text-indigo border border-line/60"
              )}
            >
              {icon}
            </div>
          )}
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wider truncate",
              isDark ? "text-white/80" : "text-ink-soft"
            )}
          >
            {title}
          </span>
        </div>
        {(badge || action) && (
          <div className="flex items-center gap-2 shrink-0">
            {badge}
            {action}
          </div>
        )}
      </div>

      {/* Main Value Display */}
      <div className="mt-1 min-w-0">
        <div
          className={cn(
            "font-mono text-xl sm:text-2xl lg:text-2xl font-semibold tracking-normal tabular-nums",
            isDark ? "text-white" : "text-ink"
          )}
        >
          {value}
        </div>

        {/* Footer / Trend / Subtitle */}
        {(trend || subtitle) && (
          <div className="mt-3 flex items-center flex-wrap gap-2 text-xs">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-xs border select-none shrink-0",
                  trend.isPositive === undefined || trend.isPositive === true
                    ? isDark
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-loam-light/80 text-loam border-loam/20"
                    : isDark
                    ? "bg-clay/30 text-white border-clay/40"
                    : "bg-clay-light/80 text-clay border-clay/20"
                )}
              >
                <span>{trend.isPositive === false ? "↓" : "↑"}</span>
                <span>{trend.value}</span>
              </span>
            )}
            {subtitle && (
              <span
                className={cn(
                  "text-xs truncate",
                  isDark ? "text-white/70" : "text-ink-soft"
                )}
              >
                {trend?.label ? trend.label : subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode | string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: TrendProps;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
  className,
  ...props
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-paper p-4 sm:p-5 shadow-2xs transition-all duration-150 flex items-center justify-between gap-4 min-w-0",
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink-soft truncate">{label}</p>
        <p className="mt-1 font-mono text-lg sm:text-xl font-semibold text-ink tracking-normal tabular-nums truncate">
          {value}
        </p>
        {subtext && <p className="mt-0.5 text-xs text-ink-soft truncate">{subtext}</p>}
      </div>

      {(icon || trend) && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          {icon && (
            <div className="p-2.5 rounded-xl bg-parchment text-indigo border border-line/60">
              {icon}
            </div>
          )}
          {trend && (
            <span
              className={cn(
                "text-xs font-semibold",
                trend.isPositive === false ? "text-clay" : "text-loam"
              )}
            >
              {trend.isPositive === false ? "↓" : "↑"} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
