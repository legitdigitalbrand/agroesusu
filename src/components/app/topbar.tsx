"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Profile } from "@/lib/types";
import { initials } from "@/lib/format";
import { Bell, Menu, ChevronDown, User, Shield, LogOut, HelpCircle, Settings, Bell as BellIcon, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();
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

  // Get active page title if not explicitly provided
  const getPageTitle = () => {
    if (title) return title;
    
    const path = pathname?.split("/").filter(Boolean)[0];
    switch (path) {
      case "dashboard":
        return "Dashboard";
      case "wallet":
        return "Wallet";
      case "savings":
        return "Savings";
      case "loans":
        return "Loans";
      case "statements":
        return "Statements";
      case "settings":
        return "Settings";
      case "profile":
        return "Profile";
      case "notifications":
        return "Notifications";
      case "dev":
        return "Developer Console";
      default:
        return "Agriqcap";
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-line bg-paper/85 px-4 backdrop-blur-md md:px-8">
      {/* Left side: Hamburger (mobile) + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-parchment/50 text-ink-soft hover:bg-parchment md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-ink md:text-xl">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right side: Notifications + Profile dropdown */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-parchment/50 text-ink-soft hover:bg-parchment transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[12px] font-bold text-white ring-2 ring-paper animate-pulse">
              {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
            </span>
          )}
        </Link>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-line" />

        {/* Profile dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 hover:opacity-90 transition"
            aria-label="Profile menu"
            aria-expanded={menuOpen}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "Profile"}
                className="h-10 w-10 rounded-xl object-cover border border-line"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-loam-light text-indigo font-bold text-sm">
                {initials(profile?.full_name || "User")}
              </div>
            )}
            <span className="hidden text-sm font-semibold text-ink-soft md:inline-block">
              {profile?.full_name?.split(" ")[0] || "User"}
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-ink-soft md:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-50 w-64 bg-paper border border-line rounded-xl shadow-lg shadow-indigo-deep/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-line bg-parchment">
                <p className="font-display font-semibold text-[14px] text-ink truncate">{profile?.full_name || "User"}</p>
                <p className="text-[12px] text-ink-soft truncate">{profile?.email || ""}</p>
              </div>
              <div className="py-1.5">
                <DropdownItem href="/profile" icon={User} label="Profile" onClick={() => setMenuOpen(false)} />
                <DropdownItem href="/settings/security" icon={Shield} label="Security" onClick={() => setMenuOpen(false)} />
                <DropdownItem href="/settings" icon={Settings} label="Settings" onClick={() => setMenuOpen(false)} />
                <DropdownItem href="/notifications" icon={BellIcon} label="Notifications" onClick={() => setMenuOpen(false)} />
                <DropdownItem href="/statements" icon={FileText} label="Statements" onClick={() => setMenuOpen(false)} />
                <DropdownItem href="/help" icon={HelpCircle} label="Help & Support" onClick={() => setMenuOpen(false)} />
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
    </header>
  );
}

function DropdownItem({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick: () => void }) {
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
