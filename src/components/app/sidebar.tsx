"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import { initials } from "@/lib/format";
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
    { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
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
            <div>
              <span className="text-xl font-bold tracking-tight text-indigo">Agriq</span><span className="text-xl font-bold tracking-tight text-ochre">cap</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-parchment text-ink-soft hover:bg-parchment md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 px-2">
          {navItems.map((item) => {
            const active = isLinkActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-indigo text-white shadow-md shadow-indigo/10"
                    : "text-ink-soft hover:bg-parchment hover:text-indigo"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-white" : "text-ink-soft group-hover:text-indigo"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile + Logout at Bottom */}
        <div className="border-t border-line pt-6 px-2">
          <div className="flex items-center gap-3 rounded-xl p-2 bg-parchment/50 mb-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "User"}
                className="h-10 w-10 rounded-full object-cover border border-indigo/10"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo/10 text-indigo font-semibold text-sm">
                {initials(profile?.full_name || "User")}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {profile?.full_name || "Agriqcap User"}
              </p>
              <p className="text-xs text-ink-soft truncate">
                {profile?.kyc_tier === "tier_0"
                  ? "Unverified Account"
                  : `KYC Tier ${profile?.kyc_tier?.split("_")[1] || "1"}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-clay hover:bg-clay/5 transition-colors duration-200"
          >
            <LogOut className="h-5 w-5 text-red-500" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
