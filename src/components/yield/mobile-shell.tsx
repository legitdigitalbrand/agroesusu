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
  Plus,
  Bell,
  ChevronDown,
  User,
  Shield,
  Settings,
  LogOut,
  Users,
  TrendingUp,
} from "lucide-react";
import { LogoMark } from "@/components/yield";
import { useMe } from "@/hooks/use-me";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Savings", href: "/savings", icon: PiggyBank },
  { name: "Loans", href: "/loans", icon: Landmark },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch unread notifications count
  const { data: unreadData } = useQuery<{ notifications?: Array<{ read: boolean }> }>({
    queryKey: ["unread-notifications-count-mobile"],
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
    // Best-effort remote signOut — always clear local state and redirect,
    // even if the network call fails (DNS error, paused project, etc.)
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch (err) {
      console.warn('[logout] Remote signOut failed, clearing local session:', err);
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-line px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark size={28} variant="customer" />
            <span className="font-display font-bold text-[16px] text-ink">Agriqcap</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Notifications Bell */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-xl bg-parchment border border-line text-ink-soft hover:text-ink transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Profile Avatar Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-1 p-1 rounded-xl border border-line bg-parchment hover:bg-parchment/80 transition-colors min-h-[44px] px-2"
                aria-label="Profile menu"
                aria-expanded={profileMenuOpen}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-loam-light text-indigo text-xs font-bold">
                  {initials(fullName)}
                </div>
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
                    <MobileMenuItem
                      href="/profile"
                      icon={User}
                      label="Profile"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <MobileMenuItem
                      href="/settings/security"
                      icon={Shield}
                      label="Security"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <MobileMenuItem
                      href="/notifications"
                      icon={Bell}
                      label="Notifications"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <MobileMenuItem
                      href="/statements"
                      icon={FileText}
                      label="Statements"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <MobileMenuItem
                      href="/cooperatives"
                      icon={Users}
                      label="Cooperatives"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <MobileMenuItem
                      href="/investments"
                      icon={TrendingUp}
                      label="Investments"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <MobileMenuItem
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 pt-4 pb-28 max-w-md mx-auto w-full">
        {children}
      </main>

      {/* Bottom Floating Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-2 bg-paper/95 backdrop-blur-md border-t border-line"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-around rounded-2xl bg-indigo-deep px-2 py-2 shadow-lg shadow-indigo-deep/30 relative">
            {/* Center Floating Action Button (FAB) — Fund Wallet */}
            <Link
              href="/wallet/deposit"
              className="absolute left-1/2 -translate-x-1/2 -top-5 h-12 w-12 rounded-full bg-ochre flex items-center justify-center shadow-lg shadow-ochre/30 border-4 border-paper transition hover:bg-ochre-light text-indigo-deep"
              aria-label="Fund Wallet"
              title="Fund Wallet"
            >
              <Plus className="h-6 w-6 text-indigo-deep" strokeWidth={2.5} />
            </Link>

            {/* Left Nav Items: Dashboard, Wallet */}
            <MobileNavItem item={mobileNavItems[0]} active={isNavActive(mobileNavItems[0].href)} />
            <MobileNavItem item={mobileNavItems[1]} active={isNavActive(mobileNavItems[1].href)} />

            {/* Center spacer for FAB */}
            <div className="w-12 flex-shrink-0" />

            {/* Right Nav Items: Savings, Loans */}
            <MobileNavItem item={mobileNavItems[2]} active={isNavActive(mobileNavItems[2].href)} />
            <MobileNavItem item={mobileNavItems[3]} active={isNavActive(mobileNavItems[3].href)} />
          </div>
        </div>
      </nav>
    </div>
  );
}

function MobileNavItem({
  item,
  active,
}: {
  item: typeof mobileNavItems[0];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors min-w-[44px] min-h-[44px]",
        active ? "text-ochre font-semibold" : "text-white/70 hover:text-white"
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
      <span className="text-[11px] leading-none">{item.name}</span>
    </Link>
  );
}

function MobileMenuItem({
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
