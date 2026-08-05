"use client";

import React from "react";
import { DesktopShell } from "@/components/yield/desktop-shell";
import { MobileShell } from "@/components/yield/mobile-shell";

// ════════════════════════════════════════════════════════════
// App layout — no promotional right rail.
// The dashboard now manages its own right column with
// contextual widgets (repayments, savings, notifications).
// Other pages get the full content width.
// ════════════════════════════════════════════════════════════

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="md:hidden">
        <MobileShell>{children}</MobileShell>
      </div>
      <div className="hidden md:block">
        <DesktopShell>{children}</DesktopShell>
      </div>
    </>
  );
}
