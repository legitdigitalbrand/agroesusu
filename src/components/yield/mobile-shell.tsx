"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PiggyBank, Landmark, TrendingUp, User, Plus } from "lucide-react";
import { LogoMark } from "@/components/yield";
import { cn } from "@/lib/utils";

// Mobile layout — bottom floating pill nav with center FAB (Quick Deposit)
// Single column, full-bleed cards, no sidebar

const navItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Save", href: "/savings", icon: PiggyBank },
  { name: "Borrow", href: "/loans", icon: Landmark },
  { name: "Invest", href: "/investments", icon: TrendingUp },
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
      {/* Top bar — minimal, just logo + greeting */}
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-track/40">
        <div className="flex items-center justify-between px-5 py-3.5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark size={28} variant="customer" />
            <span className="font-serif text-lg text-ink">Yield</span>
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-2"
          >
            <div className="h-8 w-8 rounded-full bg-indigo/10 flex items-center justify-center">
              <User className="h-4 w-4 text-indigo" />
            </div>
          </Link>
        </div>
      </header>

      {/* Main content — single column */}
      <main className="px-5 pt-4 pb-32 max-w-md mx-auto">
        {children}
      </main>

      {/* Bottom floating pill nav with center FAB */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-around rounded-full bg-indigo-deep px-2 py-2 shadow-lg shadow-indigo-deep/30 relative">
            {/* FAB — center, floating above nav */}
            <Link
              href="/savings/quick-deposit"
              className="absolute left-1/2 -translate-x-1/2 -top-6 h-14 w-14 rounded-full bg-ochre flex items-center justify-center shadow-lg shadow-ochre/30 transition hover:bg-ochre-light"
              aria-label="Quick Deposit"
            >
              <Plus className="h-6 w-6 text-indigo-deep" strokeWidth={2.5} />
            </Link>

            {/* Left nav items */}
            <NavItem item={navItems[0]} active={isNavActive(navItems[0].href)} />
            <NavItem item={navItems[1]} active={isNavActive(navItems[1].href)} />

            {/* Spacer for FAB */}
            <div className="w-14" />

            {/* Right nav items */}
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
        "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition",
        active ? "text-ochre" : "text-white/60 hover:text-white"
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
      <span className="text-[10px] font-medium">{item.name}</span>
    </Link>
  );
}
