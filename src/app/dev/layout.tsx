"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, PiggyBank, Landmark, TrendingUp, Users,
  FileText, Shield, ScrollText, LogOut, Menu, X,
} from "lucide-react";
import { LogoMark, LoadingState } from "@/components/yield";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";

// Admin console layout — desktop sidebar + mobile drawer.
// Client-side auth guard: redirects non-staff users to /dashboard.

const adminNav = [
  { name: "Dashboard", href: "/dev/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/dev/products", icon: PiggyBank },
  { name: "Loan Review", href: "/dev/loans", icon: Landmark },
  { name: "Investments", href: "/dev/investments", icon: TrendingUp },
  { name: "Cooperatives", href: "/dev/cooperatives", icon: Users },
  { name: "Audit Log", href: "/dev/audit", icon: ScrollText },
  { name: "Compliance", href: "/dev/reports", icon: FileText },
  { name: "Staff & RBAC", href: "/dev/staff", icon: Shield },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, isLoading, error } = useMe();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Client-side guard: only staff users may access admin pages
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (error || !me) {
      router.replace("/login?redirect=" + encodeURIComponent(pathname || "/dev"));
      return;
    }
  }, [isLoading, error, me, router, pathname]);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      const res = await fetch("/api/dev/bootstrap", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create admin");
      // Reload to pick up new staff status
      window.location.reload();
    } catch (err) {
      setBootstrapError(err instanceof Error ? err.message : "Failed to create admin");
      setBootstrapping(false);
    }
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <LoadingState message="Verifying admin access…" />
      </div>
    );
  }

  // Not authenticated
  if (!me) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <LoadingState message="Redirecting to login…" />
      </div>
    );
  }

  // Authenticated but not staff — show bootstrap option (DEV ONLY)
  if (me.type !== "staff") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-paper border border-line rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-display font-semibold text-[20px] text-ink mb-2">Admin Access Required</h2>
          <p className="text-[14px] text-ink-soft mb-6">
            You are signed in as <span className="font-medium text-ink">{me.profile?.full_name || me.profile?.email}</span> but do not have staff access.
            In development mode, you can promote yourself to Super Admin to access the admin console.
          </p>
          {bootstrapError && (
            <div className="bg-clay-light rounded-xl p-3 mb-4 text-left">
              <p className="text-[13px] text-clay">{bootstrapError}</p>
            </div>
          )}
          <button
            onClick={handleBootstrap}
            disabled={bootstrapping}
            className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] hover:opacity-90 transition disabled:opacity-50"
          >
            {bootstrapping ? "Creating admin access…" : "Become Super Admin (Dev Only)"}
          </button>
          <Link
            href="/dashboard"
            className="block mt-3 text-[13px] text-ink-soft hover:text-ink transition"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/dev/dashboard") return pathname === "/dev/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-paper flex">
      {/* ─── Desktop sidebar — fixed, dark indigo-deep ─── */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-indigo-deep flex-col hidden md:flex">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-6">
          <LogoMark size={32} variant="admin" />
          <div>
            <span className="font-display text-xl text-white block leading-tight">Agriqcap</span>
            <span className="text-[12px] text-white/70 uppercase tracking-wider">Admin Console</span>
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
                    ? "bg-paper/10 text-ochre"
                    : "text-white/70 hover:text-white hover:bg-paper/5"
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-paper/5 w-full transition"
          >
            <LogOut className="h-5 w-5" />
            Exit console
          </Link>
        </div>
      </aside>

      {/* ─── Mobile drawer overlay ─── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ─── Mobile drawer sidebar ─── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-indigo-deep flex flex-col md:hidden transition-transform duration-300",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + close button */}
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size={32} variant="admin" />
            <div>
              <span className="font-display text-xl text-white block leading-tight">Agriqcap</span>
              <span className="text-[12px] text-white/70 uppercase tracking-wider">Admin Console</span>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="h-9 w-9 rounded-lg bg-paper/10 flex items-center justify-center text-white/70 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
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
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition min-h-[44px]",
                  active
                    ? "bg-paper/10 text-ochre"
                    : "text-white/70 hover:text-white hover:bg-paper/5"
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
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-paper/5 w-full transition min-h-[44px]"
          >
            <LogOut className="h-5 w-5" />
            Exit console
          </Link>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Mobile top bar with hamburger */}
        <header className="sticky top-0 z-30 bg-paper border-b border-line md:hidden flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="h-10 w-10 rounded-lg flex items-center justify-center text-ink hover:bg-parchment transition"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <LogoMark size={24} variant="admin" />
            <span className="font-display font-semibold text-[15px] text-ink">Admin</span>
          </div>
          <Link
            href="/"
            className="h-10 w-10 rounded-lg flex items-center justify-center text-ink-soft hover:bg-parchment transition"
            aria-label="Exit console"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </Link>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6 md:p-8 flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
