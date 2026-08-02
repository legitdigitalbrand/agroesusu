"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Settings, Search, Bell,
  ChevronDown, User, Shield, LogOut, HelpCircle,
} from "lucide-react";
import { LogoMark } from "@/components/yield";
import { useMe } from "@/hooks/use-me";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ════════════════════════════════════════════════════════════
// DesktopShell — single navigation system (UX audit A2)
//   - Top bar: Logo + pill-style section links + search/notifications/avatar
//   - No competing left sidebar — removed per UX audit
//   - Avatar dropdown: Profile, Security, Settings, Help, Logout
//   - Right rail only renders on dashboard (UX audit A3)
// ════════════════════════════════════════════════════════════

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

  // Right rail only on dashboard (A3: nudge cards belong on dashboard only)
  const showRightRail = pathname === "/dashboard" && rightRail;

  return (
    <div className="min-h-screen bg-parchment flex flex-col">
      {/* ─── Single top navigation bar ─── */}
      <header className="sticky top-0 z-30 bg-paper border-b border-line">
        <div className="flex items-center justify-between px-6 lg:px-10 py-3.5 gap-4">
          {/* Left: Logo + pill nav */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <LogoMark size={28} variant="customer" />
              <span className="font-display font-semibold text-[16px] text-ink hidden lg:inline">Agriqcap</span>
            </Link>

            {/* Pill-style section links — sole primary navigation */}
            <div className="flex gap-1 bg-parchment rounded-xl p-1 overflow-x-auto no-scrollbar">
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
          </div>

          {/* Right: Search + notification + avatar */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden xl:flex items-center gap-2 bg-parchment border border-line rounded-lg px-3 h-[34px]">
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
            <div className="relative" ref={menuRef}>
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

              {/* Profile dropdown */}
              {menuOpen && (
                <div className="absolute right-0 top-11 z-50 w-64 bg-paper border border-line rounded-xl shadow-lg shadow-indigo-deep/10 overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-line bg-parchment">
                    <p className="font-display font-semibold text-[14px] text-ink truncate">{fullName}</p>
                    <p className="text-[12px] text-ink-soft truncate">{email}</p>
                  </div>
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
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main content — fills viewport width (A4 fix) ─── */}
      <main className="flex-1 px-6 lg:px-10 py-6 overflow-auto">
        <div className={cn(
          "flex gap-6 mx-auto",
          showRightRail ? "max-w-[1600px]" : "max-w-6xl"
        )}>
          <div className={cn("min-w-0", showRightRail ? "flex-1" : "w-full")}>
            {children}
          </div>
          {showRightRail && (
            <aside className="hidden xl:block w-80 flex-shrink-0 space-y-3.5">
              {rightRail}
            </aside>
          )}
        </div>
      </main>
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
