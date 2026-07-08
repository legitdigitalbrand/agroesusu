"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Mobile-only top header with brand logo and theme toggle.
 * Visible on screens below lg breakpoint.
 * Hidden on auth pages (they have their own centered layout).
 */
export function MobileHeader() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) return null;

  return (
    <header
      className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md"
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--nav-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--hero-pill-bg)" }}
        >
          <span className="font-bold text-xs" style={{ color: "var(--hero-pill-text)" }}>A</span>
        </div>
        <span className="text-base font-semibold tracking-tight" style={{ color: "var(--hero-text)" }}>
          AgroEsusu
        </span>
      </div>
      <ThemeToggle />
    </header>
  );
}
