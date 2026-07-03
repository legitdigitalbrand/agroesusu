"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PiggyBank, Users, Receipt, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/save", label: "Save", icon: PiggyBank },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/transactions", label: "Activity", icon: Receipt },
  { href: "/profile", label: "Profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-brand-green text-white h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-lime flex items-center justify-center">
            <span className="text-brand-green font-bold text-sm">A</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">AgroEsusu</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                isActive
                  ? "bg-white/10 text-brand-lime"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4.5 h-4.5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-lime/20 flex items-center justify-center">
            <span className="text-brand-lime font-medium text-sm">CO</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Chinedu O.</p>
            <p className="text-xs text-white/50">Basic tier</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
