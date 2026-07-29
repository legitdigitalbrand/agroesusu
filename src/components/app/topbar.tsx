"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Profile } from "@/lib/types";
import { initials } from "@/lib/format";
import { Bell, Menu } from "lucide-react";

interface TopbarProps {
  profile: Profile;
  unreadNotificationsCount: number;
  onMenuToggle: () => void;
  title?: string;
}

export default function Topbar({
  profile,
  unreadNotificationsCount,
  onMenuToggle,
  title,
}: TopbarProps) {
  const pathname = usePathname();

  // Get active page title if not explicitly provided
  const getPageTitle = () => {
    if (title) return title;
    
    const path = pathname?.split("/").filter(Boolean)[0];
    switch (path) {
      case "dashboard":
        return "Dashboard";
      case "savings":
        return "Savings & Goals";
      case "loans":
        return "Loans & Capital";
      case "transactions":
        return "Transactions";
      case "profile":
        return "My Profile";
      case "admin":
        return "Admin Panel";
      case "notifications":
        return "Notifications";
      default:
        return "Agriqcap";
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-100 bg-white/85 px-4 backdrop-blur-md md:px-8">
      {/* Left side: Hamburger (mobile) + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-gray-50/50 text-gray-600 hover:bg-gray-50 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 md:text-xl">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right side: Notifications + Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-gray-50/50 text-gray-500 hover:bg-gray-50 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[12px] font-bold text-white ring-2 ring-white animate-pulse">
              {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
            </span>
          )}
        </Link>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-gray-100" />

        {/* User profile avatar */}
        <Link
          href="/profile"
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || "Profile"}
              className="h-10 w-10 rounded-xl object-cover border border-indigo/10"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo/10 text-indigo font-bold text-sm">
              {initials(profile?.full_name || "User")}
            </div>
          )}
          <span className="hidden text-sm font-semibold text-gray-700 md:inline-block">
            {profile?.full_name?.split(" ")[0] || "User"}
          </span>
        </Link>
      </div>
    </header>
  );
}
