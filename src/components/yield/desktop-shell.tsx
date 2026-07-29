"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, FileText, Wallet, Users, TrendingUp,
  Settings, Search, Bell,
} from "lucide-react";
import { LogoMark } from "@/components/yield";
import { useMe } from "@/hooks/use-me";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════
// DesktopShell — matches the approved mockup exactly:
//   - Slim icon-only left rail (64px): logo, 5 nav icons, settings, avatar
//   - Horizontal top nav bar with pill-style section links
//   - Search/notification/avatar cluster on the right
//   - Two-column main: left content + right rail
//
// The icon rail and top nav are DIFFERENT navigation systems:
//   Rail: Home, History, Wallet, Co-op, Invest (icon-only)
//   Top:  Home, Savings, Loans, Cooperative, Investments (pill links)
//
// This is NOT "mobile but wider" — it's an intentionally different paradigm.
// ════════════════════════════════════════════════════════════

const railItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/statements", icon: FileText, label: "History" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/cooperative", icon: Users, label: "Co-op" },
  { href: "/investments", icon: TrendingUp, label: "Invest" },
];

const topNavItems = [
  { name: "Home", href: "/dashboard" },
  { name: "Savings", href: "/savings" },
  { name: "Loans", href: "/loans" },
  { name: "Cooperative", href: "/cooperative" },
  { name: "Investments", href: "/investments" },
];

// Mobile shell re-export
import { MobileShell } from "./mobile-shell";
export { MobileShell };

interface DesktopShellProps {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
}

export function DesktopShell({ children, rightRail }: DesktopShellProps) {
  const pathname = usePathname();
  const { data: me } = useMe();

  const isRailActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  const isTopNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  const fullName = me?.profile?.full_name || "User";

  return (
    <div className="min-h-screen bg-parchment flex">
      {/* ─── Slim icon-only left rail (64px) ─── */}
      <aside className="fixed inset-y-0 left-0 z-50 w-16 bg-paper border-r border-line flex flex-col items-center py-5 gap-1.5">
        {/* Logo mark */}
        <LogoMark size={26} variant="customer" />

        {/* Separator */}
        <div className="h-px w-7 bg-line my-2.5" />

        {/* Rail nav items */}
        {railItems.map((item) => {
          const Icon = item.icon;
          const active = isRailActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center transition",
                active
                  ? "bg-indigo text-white"
                  : "text-ink-soft hover:text-ink hover:bg-parchment"
              )}
              aria-label={item.label}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 1.8} />
            </Link>
          );
        })}

        {/* Bottom: settings + avatar */}
        <div className="mt-auto flex flex-col items-center gap-1.5">
          <Link
            href="/settings"
            className="h-10 w-10 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-parchment transition"
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <Link
            href="/profile"
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-loam-light text-indigo text-xs font-medium transition hover:opacity-80"
            aria-label="Profile"
          >
            {initials(fullName)}
          </Link>
        </div>
      </aside>

      {/* ─── Main column (offset by rail width) ─── */}
      <div className="flex-1 ml-16 flex flex-col min-w-0">
        {/* ─── Horizontal top nav bar ─── */}
        <header className="sticky top-0 z-30 bg-paper border-b border-line">
          <div className="flex items-center justify-between px-7 py-4">
            {/* Pill-style section links */}
            <div className="flex gap-1 bg-parchment rounded-xl p-1">
              {topNavItems.map((item) => {
                const active = isTopNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition",
                      active
                        ? "bg-indigo text-white"
                        : "text-ink-soft hover:text-ink"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Search + notification + avatar cluster */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-parchment border border-line rounded-lg px-3 h-[34px]">
                <Search className="h-3.5 w-3.5 text-ink-soft" />
                <input
                  type="text"
                  placeholder="Search…"
                  className="bg-transparent text-xs text-ink outline-none placeholder:text-ink-soft/50 w-32"
                />
              </div>
              <Link
                href="/notifications"
                className="h-[34px] w-[34px] rounded-lg bg-parchment border border-line flex items-center justify-center text-ink-soft hover:text-ink transition relative"
              >
                <Bell className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </header>

        {/* ─── Main content — two-column: primary + right rail ─── */}
        <main className="flex-1 px-7 py-6 overflow-auto">
          <div className="flex gap-5 max-w-7xl">
            <div className="flex-1 min-w-0">
              {children}
            </div>
            {rightRail && (
              <aside className="w-80 flex-shrink-0 space-y-3.5">
                {rightRail}
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
