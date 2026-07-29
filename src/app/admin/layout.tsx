"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, PiggyBank, Landmark, TrendingUp, Users,
  FileText, Shield, ScrollText, LogOut,
} from "lucide-react";
import { LogoMark, LoadingState } from "@/components/yield";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";

// Admin console layout — always desktop sidebar-shell pattern.
// Never a mobile layout (admin/staff tooling is desktop-primary per Phase 1/9).
// Client-side auth guard: redirects non-staff users to /dashboard.

const adminNav = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/admin/products", icon: PiggyBank },
  { name: "Loan Review", href: "/admin/loans", icon: Landmark },
  { name: "Investments", href: "/admin/investments", icon: TrendingUp },
  { name: "Cooperatives", href: "/admin/cooperatives", icon: Users },
  { name: "Audit Log", href: "/admin/audit", icon: ScrollText },
  { name: "Compliance", href: "/admin/reports", icon: FileText },
  { name: "Staff & RBAC", href: "/admin/staff", icon: Shield },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, isLoading, error } = useMe();

  // Client-side guard: only staff users may access admin pages
  useEffect(() => {
    if (isLoading) return;
    if (error || !me) {
      router.replace("/login?redirect=" + encodeURIComponent(pathname || "/admin"));
      return;
    }
    if (me.type !== "staff") {
      // Authenticated but not staff — redirect to customer dashboard
      router.replace("/dashboard");
    }
  }, [isLoading, error, me, router, pathname]);

  // Show loading state while checking auth
  if (isLoading || !me || me.type !== "staff") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <LoadingState message="Verifying admin access…" />
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/admin/dashboard") return pathname === "/admin/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-paper flex">
      {/* Sidebar — dark indigo-deep, always visible on desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-indigo-deep flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-6">
          <LogoMark size={32} variant="admin" />
          <div>
            <span className="font-serif text-xl text-white block leading-tight">Agriqcap</span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Admin Console</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {adminNav.map((item) => {
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

        {/* Footer — logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 w-full transition"
          >
            <LogOut className="h-5 w-5" />
            Exit console
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 ml-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
