"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  Landmark,
  FileText,
  Settings,
  LogOut,
  Search,
  Bell,
  User,
  Shield,
  ChevronDown,
} from "lucide-react";
import { LogoMark } from "@/components/yield";
import { useMe } from "@/hooks/use-me";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// Re-export MobileShell for backward compatibility
export { MobileShell } from "./mobile-shell";

// Navigation items for the customer sidebar (strictly as ordered)
const sidebarNavItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Savings", href: "/savings", icon: PiggyBank },
  { name: "Loans", href: "/loans", icon: Landmark },
  { name: "Statements", href: "/statements", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface DesktopShellProps {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
}

export function DesktopShell({ children, rightRail }: DesktopShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch unread notifications count from real backend API
  const { data: unreadData } = useQuery<{ notifications?: Array<{ read: boolean }> }>({
    queryKey: ["unread-notifications-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?read=false&limit=20");
      if (!res.ok) return { notifications: [] };
      return res.json();
    },
    enabled: !!me,
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.notifications?.filter((n) => !n.read).length || 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  const fullName = me?.profile?.full_name || "User";
  const email = me?.profile?.email || me?.profile?.phone || "";

  const handleLogout = async () => {
    const supabase = createClient();
    // Best-effort remote signOut — always clear local state and redirect,
    // even if the network call fails (DNS error, paused project, etc.)
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[logout] Remote signOut failed, clearing local session:', err);
    }
    router.push("/login");
    router.refresh();
  };

  const showRightRail = pathname === "/dashboard" && rightRail;

  return (
    <div className="min-h-screen bg-parchment flex">
      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside className="w-64 bg-paper border-r border-line flex flex-col h-screen sticky top-0 flex-shrink-0 z-30">
        {/* Brand Header */}
        <div className="p-6 border-b border-line">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <LogoMark size={32} variant="customer" />
            <div className="flex flex-col">
              <span className="font-display font-bold text-[18px] text-ink leading-tight group-hover:text-indigo transition">
                Agriqcap
              </span>
              <span className="text-[11px] text-ink-soft tracking-wide">
                AgroEsusu Fintech
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {sidebarNavItems.map((item) => {
            const active = isNavActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] font-medium transition-colors",
                  active
                    ? "bg-loam-light text-indigo font-semibold shadow-xs"
                    : "text-ink-soft hover:text-ink hover:bg-parchment/70"
                )}
              >
                <Icon
                  className={cn("h-5 w-5 flex-shrink-0", active ? "text-indigo" : "text-ink-soft")}
                  strokeWidth={1.8}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Nav list Logout option (Item #7 in sidebar nav sequence) */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] font-medium text-clay hover:bg-clay-light/50 transition-colors text-left"
          >
            <LogOut className="h-5 w-5 text-clay flex-shrink-0" strokeWidth={1.8} />
            <span>Logout</span>
          </button>
        </nav>

        {/* Sidebar Footer: User Profile Mini-Card */}
        <div className="p-3 border-t border-line bg-paper">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-parchment/60 border border-line">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-loam-light text-indigo text-xs font-bold border border-loam/20">
                {initials(fullName)}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink truncate leading-tight">
                  {fullName}
                </p>
                <p className="text-[11px] text-ink-soft truncate leading-tight mt-0.5">
                  {email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-ink-soft hover:text-clay hover:bg-clay-light transition-colors ml-1"
              title="Sign out"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur-md border-b border-line px-6 lg:px-10 py-3.5 flex items-center justify-between gap-4">
          {/* Search Bar Placeholder */}
          <div className="flex items-center gap-2.5 bg-parchment/80 border border-line rounded-xl px-3.5 py-2 w-72 lg:w-80 opacity-85">
            <Search className="h-4 w-4 text-ink-soft flex-shrink-0" strokeWidth={1.8} />
            <input
              type="text"
              readOnly
              disabled
              placeholder="Search transactions, savings… (⌘K)"
              className="bg-transparent text-xs text-ink outline-none placeholder:text-ink-soft/60 w-full cursor-not-allowed"
            />
          </div>

          {/* Right Top Bar Controls: Notifications + Profile Dropdown */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <Link
              href="/notifications"
              className="relative h-10 w-10 rounded-xl bg-paper border border-line flex items-center justify-center text-ink-soft hover:text-ink hover:bg-parchment transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* User Avatar Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2.5 p-1 pr-2.5 rounded-xl border border-line bg-paper hover:bg-parchment transition-colors"
                aria-label="User profile menu"
                aria-expanded={profileMenuOpen}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-loam-light text-indigo text-xs font-bold">
                  {initials(fullName)}
                </div>
                <span className="text-xs font-semibold text-ink hidden sm:inline-block">
                  {fullName.split(" ")[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-ink-soft" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 bg-paper border border-line rounded-2xl shadow-lg shadow-indigo-deep/10 overflow-hidden py-1">
                  <div className="px-4 py-3 border-b border-line bg-parchment/60">
                    <p className="font-display font-semibold text-[14px] text-ink truncate">
                      {fullName}
                    </p>
                    <p className="text-[12px] text-ink-soft truncate">{email}</p>
                  </div>
                  <div className="py-1">
                    <DropdownMenuItem
                      href="/profile"
                      icon={User}
                      label="Profile"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <DropdownMenuItem
                      href="/settings/security"
                      icon={Shield}
                      label="Security"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <DropdownMenuItem
                      href="/notifications"
                      icon={Bell}
                      label="Notifications"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <DropdownMenuItem
                      href="/settings"
                      icon={Settings}
                      label="Settings"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <div className="my-1 h-px bg-line" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-clay hover:bg-clay-light transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.8} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 px-6 lg:px-10 py-6 overflow-y-auto">
          <div
            className={cn(
              "flex gap-6 mx-auto",
              showRightRail ? "max-w-[1600px]" : "max-w-6xl"
            )}
          >
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
    </div>
  );
}

function DropdownMenuItem({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-ink hover:bg-parchment transition-colors"
    >
      <Icon className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}
