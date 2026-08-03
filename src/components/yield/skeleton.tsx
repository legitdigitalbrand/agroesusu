"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "rectangular",
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps) {
  const variantMap = {
    text: "h-4 w-full rounded-md",
    circular: "rounded-full shrink-0",
    rectangular: "rounded-2xl w-full",
  };

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-gradient-to-r from-track/40 via-line/60 to-track/40 bg-[length:200%_100%]",
        variantMap[variant],
        className
      )}
      style={inlineStyles}
      aria-hidden="true"
      {...props}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[22px] border border-line/80 bg-paper p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-1/3 h-5" />
        <Skeleton variant="circular" className="w-8 h-8" />
      </div>
      <Skeleton variant="text" className="w-2/3 h-8" />
      <Skeleton variant="text" className="w-1/2 h-4" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center justify-between py-4 px-6 border-b border-line/60 gap-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" className={cn("h-4", i === 0 ? "w-1/3" : "w-1/6")} />
      ))}
    </div>
  );
}
