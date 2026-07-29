"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, PiggyBank, Landmark, Users, TrendingUp,
  FileText, Settings, Search, Bell, LogOut, 
} from "lucide-react";
import { LogoMark } from "@/components/yield";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Savings", href: "/savings", icon: PiggyBank },
  { name: "Loans", href: "/loans", icon: Landmark },
  { name: "Cooperative", href: "/cooperative", icon: Users },
  { name: "Investments", href: "/investments", icon: TrendingUp },
  { name: "Statements", href: "/statements", icon: FileText },
  { name: "Settings", href: "/profile", icon: Settings },
];

// Mobile shell — re-exported for use in (app) layout
import { MobileShell } from "./mobile-shell";

export { MobileShell };

// Desktop shell — persistent sidebar, top bar, two-column main with right rail
interface DesktopShellProps {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
}

export function DesktopShell({ children, rightRail }: DesktopShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-paper flex">
      {/* Sidebar — persistent */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-indigo-deep flex flex-col">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <LogoMark size={32} variant="admin" />
          <span className="font-serif text-xl text-white">Agriqcap</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-ochre"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <Link
            href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 w-full transition"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-track/40">
          <div className="flex items-center justify-between px-8 py-3.5">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-ink-soft" />
              <input
                type="text"
                placeholder="Search transactions, accounts…"
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/50"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="relative text-ink-soft hover:text-ink transition">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-ochre" />
              </button>
              <Link href="/profile" className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-indigo/10 flex items-center justify-center text-sm font-medium text-indigo">
                  U
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Main content — two-column: primary + right rail */}
        <main className="px-8 py-6">
          <div className="flex gap-6 max-w-7xl">
            <div className="flex-1 min-w-0">
              {children}
            </div>
            {rightRail && (
              <aside className="w-80 flex-shrink-0 space-y-4">
                {rightRail}
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
