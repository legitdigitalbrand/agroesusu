"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { HomeIcon, PiggyIcon, UsersIcon, ReceiptIcon, UserIcon } from "@/components/icons";

const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/save", label: "Save", icon: PiggyIcon },
  { href: "/groups", label: "Groups", icon: UsersIcon },
  { href: "/transactions", label: "Activity", icon: ReceiptIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
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
    <aside
      className="hidden lg:flex flex-col w-60 h-screen sticky top-0 border-r"
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="px-6 py-6 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <span className="font-bold text-sm" style={{ color: "var(--nav-bg)" }}>A</span>
          </div>
          <span className="text-lg font-semibold tracking-tight" style={{ color: "#E6FFEC" }}>
            AgroEsusu
          </span>
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? "var(--accent-subtle)" : "transparent",
                color: isActive ? "var(--accent)" : "rgba(230,255,236,0.45)",
              }}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: "var(--border-subtle)" }}>
        <ThemeToggle />
        <div className="flex-1 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-subtle)" }}
          >
            <span className="font-medium text-sm" style={{ color: "var(--accent)" }}>{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "#E6FFEC" }}>
              {user?.full_name || "User"}
            </p>
            <p className="text-xs capitalize" style={{ color: "rgba(230,255,236,0.3)" }}>
              {user?.tier || "basic"} tier
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
