"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";

import {
  LayoutDashboard,
  PiggyBank,
  Landmark as LandCredit,
  ArrowLeftRight,
  User,
  Shield,
  LogOut,
  X,
} from "lucide-react";

interface SidebarProps {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ profile, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Savings", href: "/savings", icon: PiggyBank },
    { name: "Loans", href: "/loans", icon: LandCredit },
    { name: "Statements", href: "/statements", icon: ArrowLeftRight },
    { name: "Profile", href: "/profile", icon: User },
  ];

  // Only show Admin Panel if user is an admin
  if (profile?.role === "admin") {
    navItems.push({ name: "Dev Console", href: "/dev", icon: Shield });
  }

  const isLinkActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-line bg-paper px-5 py-6 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between px-2 pb-8">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo text-white font-bold text-lg shadow-sm">
              A
            </div>
            <span className="font-display font-bold text-ink text-lg">Agriqcap</span>
          </Link>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-parchment md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${
                  active
                    ? "bg-indigo text-white"
                    : "text-ink-soft hover:text-ink hover:bg-parchment"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="pt-4 border-t border-line">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-clay hover:bg-clay-light transition"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.8} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
