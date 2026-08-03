"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "light" | "flat" | "elevated" | "interactive" | "dark";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "light",
      padding = "md",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const paddingMap = {
      none: "p-0",
      sm: "p-4",
      md: "p-5 sm:p-6",
      lg: "p-6 sm:p-8",
    };

    const variantMap = {
      // Light / Elevated: premium fintech card with subtle multi-layer shadow
      light: "bg-paper border border-line/80 shadow-[0_1px_2px_rgba(26,36,23,0.03),0_8px_24px_rgba(26,36,23,0.04)]",
      elevated: "bg-paper border border-line/80 shadow-[0_1px_2px_rgba(26,36,23,0.03),0_8px_24px_rgba(26,36,23,0.04)]",
      // Flat: simple paper surface with crisp border
      flat: "bg-paper border border-line shadow-none",
      // Interactive: hover rise effect with deeper shadow
      interactive:
        "bg-paper border border-line/80 shadow-[0_1px_2px_rgba(26,36,23,0.03),0_6px_16px_rgba(26,36,23,0.03)] hover:shadow-[0_4px_12px_rgba(26,36,23,0.05),0_16px_32px_rgba(26,36,23,0.07)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
      // Dark: deep forest green gradient card (for wallet/hero cards)
      dark: "bg-gradient-to-br from-indigo via-indigo to-indigo-deep text-white border border-indigo-light/20 shadow-[0_8px_24px_rgba(18,61,21,0.25)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[22px] overflow-hidden transition-all duration-200",
          variantMap[variant],
          paddingMap[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 mb-4", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-lg font-semibold text-ink leading-snug tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs sm:text-sm text-ink-soft leading-relaxed", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between pt-4 mt-4 border-t border-line/60", className)}
      {...props}
    />
  );
}
