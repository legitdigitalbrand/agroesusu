"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, FileText, Wallet, Landmark, Plus,
  ChevronDown, User, Shield, LogOut, HelpCircle, Settings, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

// ════════════════════════════════════════════════════════════
// MobileShell — simplified product navigation
//   - Single column, full-bleed cards, no sidebar
//   - Bottom floating pill nav (indigo-deep) with center FAB
//   - Nav items: Home, Wallet, [FAB: Quick Save], Savings, Loans
//   - Profile dropdown accessible from top bar avatar
//   - iOS safe-area-inset padding for notched devices
// ════════════════════════════════════════════════════════════

const navItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Savings", href: "/savings", icon: FileText },
  { name: "Loans", href: "/loans", icon: Landmark },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
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

  const isNavActive = (href: string) => {
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
    <div className="min-h-screen bg-paper">
      {/* Top bar with profile avatar dropdown */}
      <div className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-line px-5 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMarkSmall />
            <span className="font-display font-semibold text-[16px] text-ink">Agriqcap</span>
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1.5"
              aria-label="Profile menu"
              aria-expanded={menuOpen}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-loam-light text-indigo text-xs font-medium">
                {initials(fullName)}
              </div>
              <ChevronDown className="h-3 w-3 text-ink-soft" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-50 w-64 bg-paper border border-line rounded-xl shadow-lg shadow-indigo-deep/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-line bg-parchment">
                  <p className="font-display font-semibold text-[14px] text-ink truncate">{fullName}</p>
                  <p className="text-[12px] text-ink-soft truncate">{email}</p>
                </div>
                <div className="py-1.5">
                  <MobileMenuItem href="/profile" icon={User} label="Profile" onClick={() => setMenuOpen(false)} />
                  <MobileMenuItem href="/settings/security" icon={Shield} label="Security" onClick={() => setMenuOpen(false)} />
                  <MobileMenuItem href="/settings" icon={Settings} label="Settings" onClick={() => setMenuOpen(false)} />
                  <MobileMenuItem href="/help" icon={HelpCircle} label="Help & Support" onClick={() => setMenuOpen(false)} />
                  <MobileMenuItem href="/cooperatives" icon={Building2} label="Cooperatives" onClick={() => setMenuOpen(false)} />
                  <MobileMenuItem href="/statements" icon={FileText} label="Statements" onClick={() => setMenuOpen(false)} />
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

      {/* Main content — single column, max-width constrained */}
      <main className="px-5 pt-4 pb-28 max-w-md mx-auto">
        {children}
      </main>

      {/* Bottom floating pill nav with center FAB */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-2"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-around rounded-full bg-indigo-deep px-2 py-2.5 shadow-lg shadow-indigo-deep/30 relative">
            {/* FAB — center, floating above nav — the single ochre accent */}
            <Link
              href="/savings"
              className="absolute left-1/2 -translate-x-1/2 -top-5 h-12 w-12 rounded-full bg-ochre flex items-center justify-center shadow-lg shadow-ochre/30 border-4 border-paper transition hover:bg-ochre-light"
              aria-label="Quick Save"
            >
              <Plus className="h-5 w-5 text-indigo-deep" strokeWidth={2.5} />
            </Link>

            {/* Left nav items (Home, Wallet) */}
            <MobileNavItem item={navItems[0]} active={isNavActive(navItems[0].href)} />
            <MobileNavItem item={navItems[1]} active={isNavActive(navItems[1].href)} />

            {/* Spacer for FAB */}
            <div className="w-12" />

            {/* Right nav items (Savings, Loans) */}
            <MobileNavItem item={navItems[2]} active={isNavActive(navItems[2].href)} />
            <MobileNavItem item={navItems[3]} active={isNavActive(navItems[3].href)} />
          </div>
        </div>
      </nav>
    </div>
  );
}

function MobileNavItem({ item, active }: { item: typeof navItems[0]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1 transition min-w-[44px] min-h-[44px] justify-center",
        active ? "text-ochre" : "text-white/70 hover:text-white"
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 1.8} />
      <span className="text-[11px] font-medium">{item.name}</span>
    </Link>
  );
}

function MobileMenuItem({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick: () => void }) {
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

function LogoMarkSmall() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo">
      <span className="text-white font-bold text-sm">A</span>
    </div>
  );
}
