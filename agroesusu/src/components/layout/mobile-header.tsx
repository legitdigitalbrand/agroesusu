"use client";

import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Mobile-only top header with brand logo and theme toggle.
 * Visible on screens below lg breakpoint.
 */
export function MobileHeader() {
  return (
    <header
      className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b"
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--nav-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--accent)" }}
        >
          <span className="font-bold text-xs" style={{ color: "var(--nav-bg)" }}>A</span>
        </div>
        <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          AgroEsusu
        </span>
      </div>
      <ThemeToggle />
    </header>
  );
}
