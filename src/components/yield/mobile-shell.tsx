"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, FileText, Wallet, User, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════
// MobileShell — matches the approved mockup exactly:
//   - Single column, full-bleed cards, no sidebar
//   - Bottom floating pill nav (indigo-deep) with center FAB
//   - Nav items: Home, History, [FAB: Quick Deposit], Wallet, Profile
//   - The FAB is the SINGLE ochre accent per screen (design rule)
// ════════════════════════════════════════════════════════════

const navItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "History", href: "/statements", icon: FileText },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Profile", href: "/profile", icon: User },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-paper">
      {/* Main content — single column, max-width constrained */}
      <main className="px-5 pt-6 pb-28 max-w-md mx-auto">
        {children}
      </main>

      {/* Bottom floating pill nav with center FAB */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-around rounded-full bg-indigo-deep px-2 py-2.5 shadow-lg shadow-indigo-deep/30 relative">
            {/* FAB — center, floating above nav — the single ochre accent */}
            <Link
              href="/savings"
              className="absolute left-1/2 -translate-x-1/2 -top-5 h-12 w-12 rounded-full bg-ochre flex items-center justify-center shadow-lg shadow-ochre/30 border-4 border-paper transition hover:bg-ochre-light"
              aria-label="Quick Deposit"
            >
              <Plus className="h-5 w-5 text-indigo-deep" strokeWidth={2.5} />
            </Link>

            {/* Left nav items (Home, History) */}
            <NavItem item={navItems[0]} active={isNavActive(navItems[0].href)} />
            <NavItem item={navItems[1]} active={isNavActive(navItems[1].href)} />

            {/* Spacer for FAB */}
            <div className="w-12" />

            {/* Right nav items (Wallet, Profile) */}
            <NavItem item={navItems[2]} active={isNavActive(navItems[2].href)} />
            <NavItem item={navItems[3]} active={isNavActive(navItems[3].href)} />
          </div>
        </div>
      </nav>
    </div>
  );
}

function NavItem({ item, active }: { item: typeof navItems[0]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1 transition",
        active ? "text-ochre" : "text-white/50 hover:text-white"
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 1.8} />
      <span className="text-[10px] font-medium">{item.name}</span>
    </Link>
  );
}
