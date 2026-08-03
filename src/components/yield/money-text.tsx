"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  /** Show currency symbol (₦). Default true. */
  showSymbol?: boolean;
  /** Decimal places. Default 0 for whole numbers, 2 if non-zero cents. */
  decimals?: number;
  /** Visual variant — "default" inherits parent text color (works on dark or light cards) */
  variant?: "default" | "dark" | "positive" | "negative";
  /** Size class override */
  sizeClassName?: string;
  /** Weight class */
  weightClassName?: string;
  /** Additional className for the number portion */
  numberClassName?: string;
  /** Whether to animate positive/negative */
  signed?: boolean;
  /** @deprecated use `value` */
  amount?: number;
}

/**
 * MoneyText — the single source of truth for rendering Naira currency figures.
 *
 * Renders the ₦ symbol and the number as separate spans so the symbol can
 * use a font with proper ₦ glyph support (U+20A6) while the number stays
 * in the brand mono font. This fixes the "NO with strikethrough" overlap
 * bug caused by IBM Plex Mono lacking the ₦ glyph.
 *
 * variant="default" does NOT set a text color — it inherits from the parent.
 * This makes it work correctly on both dark cards (parent sets text-white)
 * and light cards (parent sets text-ink) without needing to know the context.
 * Use variant="dark"/"positive"/"negative" to force a specific color.
 */
export function MoneyText({
  value: valueProp,
  amount: amountProp,
  showSymbol = true,
  decimals,
  variant = "default",
  sizeClassName = "text-2xl",
  weightClassName = "font-semibold",
  numberClassName,
  signed = false,
  className,
  ...props
}: MoneyTextProps) {
  // Support both `value` (preferred) and `amount` (legacy) props
  const value = valueProp ?? amountProp ?? 0;

  // Determine decimal places
  const hasFraction = Math.abs(value % 1) > 0;
  const decimalsToUse = decimals ?? (hasFraction ? 2 : 0);

  // Format the number portion using en-NG locale
  const formattedNumber = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: decimalsToUse,
    maximumFractionDigits: decimalsToUse,
  }).format(Math.abs(value));

  const isNegative = value < 0;
  const showSign = signed && (isNegative || value > 0);

  // "default" intentionally sets NO color class — inherits from parent.
  // This is the key fix for dark-card contrast: a MoneyText inside a
  // text-white parent will render white, inside a text-ink parent will
  // render dark, with no explicit override needed at the call site.
  const variantClass = {
    default: "", // inherit from parent
    dark: "text-white",
    positive: "text-loam",
    negative: "text-clay",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 font-mono tabular-nums",
        variantClass,
        sizeClassName,
        weightClassName,
        className
      )}
      {...props}
    >
      {showSymbol && (
        <span
          className="naira-symbol"
          aria-hidden="true"
        >
          {isNegative ? "-₦" : "₦"}
        </span>
      )}
      {showSign && !isNegative && <span>+</span>}
      <span className={cn(numberClassName)}>{formattedNumber}</span>
    </span>
  );
}

/**
 * formatNairaKobo — formats a number as a Naira string with proper decimals.
 * Use this for non-JSX contexts (API responses, tooltips, chart formatters).
 * Returns "₦X,XXX" or "₦X,XXX.XX" with the ₦ symbol included.
 */
export function formatNairaKobo(amount: number, decimals?: number): string {
  const hasFraction = Math.abs(amount % 1) > 0;
  const decimalsToUse = decimals ?? (hasFraction ? 2 : 0);
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: decimalsToUse,
    maximumFractionDigits: decimalsToUse,
  }).format(Math.abs(amount));

  return `${amount < 0 ? "-₦" : "₦"}${formatted}`;
}
