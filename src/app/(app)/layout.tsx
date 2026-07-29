"use client";

import React from "react";
import { AppShell } from "@/components/yield/desktop-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // The layout wraps every authenticated customer page.
  // On mobile: bottom floating pill nav with center FAB.
  // On desktop: persistent sidebar + topbar + two-column main.
  // Right rail content is injected per-page (via a context or passed through).
  // For now, the shell renders children in the primary column.
  return <AppShell>{children}</AppShell>;
}
