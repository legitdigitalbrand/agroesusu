"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, FileText, Wallet, Landmark, Settings, Search, Bell,
  ChevronDown, User, Shield, LogOut, HelpCircle,
} from "lucide-react";
import { LogoMark } from "@/components/yield";
import { useMe } from "@/hooks/use-me";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ════════════════════════════════════════════════════════════
// DesktopShell — simplified product navigation
//   - Slim icon-only left rail (64px): logo, nav icons, settings, avatar
//   - Horizontal top nav bar with pill-style section links
//   - Avatar opens a dropdown menu (profile, security, settings, logout)
//
// Active product: Wallet, Savings, Loans, Statements
// Removed from current product: Cooperative, Investments
// ════════════════════════════════════════════════════════════

const railItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/savings", icon: FileText, label: "Savings" },
  { href: "/loans", icon: Landmark, label: "Loans" },
  { href: "/statements", icon: FileText, label: "Statements" },
];

const topNavItems = [
  { name: "Home", href: "/dashboard" },
  { name: "Wallet", href: "/wallet" },
  { name: "Savings", href: "/savings" },
  { name: "Loans", href: "/loans" },
  { name: "Statements", href: "/statements" },
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
  const router = useRouter();
  const { data: me } = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isRailActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  const isTopNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  const fullName = me?.profile?.full_name || "User";
  const email = me?.profile?.email || "";

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

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
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-loam-light text-indigo text-xs font-medium transition hover:opacity-80"
            aria-label="Profile menu"
            aria-expanded={menuOpen}
          >
            {initials(fullName)}
          </button>
        </div>
      </aside>

      {/* ─── Profile dropdown menu ─── */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed left-16 bottom-5 z-50 w-64 bg-paper border border-line rounded-xl shadow-lg shadow-indigo-deep/10 overflow-hidden"
        >
          {/* User info header */}
          <div className="px-4 py-3.5 border-b border-line bg-parchment">
            <p className="font-display font-semibold text-[14px] text-ink truncate">{fullName}</p>
            <p className="text-[12px] text-ink-soft truncate">{email}</p>
          </div>
          {/* Menu items */}
          <div className="py-1.5">
            <MenuItem href="/profile" icon={User} label="Profile" onClick={() => setMenuOpen(false)} />
            <MenuItem href="/settings/security" icon={Shield} label="Security" onClick={() => setMenuOpen(false)} />
            <MenuItem href="/settings" icon={Settings} label="Settings" onClick={() => setMenuOpen(false)} />
            <MenuItem href="/help" icon={HelpCircle} label="Help & Support" onClick={() => setMenuOpen(false)} />
            <div className="my-1 h-px bg-line" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-clay hover:bg-clay-light transition"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
              Log out
            </button>
          </div>
        </div>
      )}

      {/* ─── Main column (offset by rail width) ─── */}
      <div className="flex-1 ml-16 flex flex-col min-w-0">
        {/* ─── Horizontal top nav bar ─── */}
        <header className="sticky top-0 z-30 bg-paper border-b border-line">
          <div className="flex items-center justify-between px-5 lg:px-7 py-4 gap-4">
            {/* Pill-style section links — horizontally scrollable on smaller desktops */}
            <div className="flex gap-1 bg-parchment rounded-xl p-1 overflow-x-auto no-scrollbar flex-shrink-0">
              {topNavItems.map((item) => {
                const active = isTopNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition whitespace-nowrap",
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
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden lg:flex items-center gap-2 bg-parchment border border-line rounded-lg px-3 h-[34px]">
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
              {/* Desktop avatar with name + chevron */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 hover:opacity-90 transition"
                aria-label="Profile menu"
                aria-expanded={menuOpen}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-loam-light text-indigo text-xs font-medium">
                  {initials(fullName)}
                </div>
                <span className="hidden text-sm font-semibold text-ink-soft md:inline-block">
                  {fullName.split(" ")[0]}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-ink-soft md:block" />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Main content — two-column: primary + right rail ─── */}
        <main className="flex-1 px-5 lg:px-7 py-6 overflow-auto">
          <div className="flex gap-5 max-w-7xl">
            <div className="flex-1 min-w-0">
              {children}
            </div>
            {rightRail && (
              <aside className="hidden lg:block w-80 flex-shrink-0 space-y-3.5">
                {rightRail}
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function MenuItem({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink hover:bg-parchment transition"
    >
      <Icon className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
      {label}
    </Link>
  );
}
