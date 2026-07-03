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

interface SidebarProps {
  user: { full_name: string; email: string; tier: string } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) return null;

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-brand-900 text-brand-50 h-screen sticky top-0 border-r border-brand-500/10">
      <div className="px-6 py-6 border-b border-brand-500/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-brand-950 font-bold text-sm">A</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-brand-50">AgroEsusu</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-500/15 text-brand-400"
                  : "text-brand-200/60 hover:text-brand-100 hover:bg-brand-500/5"
              )}
            >
              <Icon className="w-4.5 h-4.5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-brand-500/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-500/15 flex items-center justify-center shrink-0">
            <span className="text-brand-400 font-medium text-sm">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-100 truncate">{user?.full_name || "User"}</p>
            <p className="text-xs text-brand-300/50 capitalize">{user?.tier || "basic"} tier</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
