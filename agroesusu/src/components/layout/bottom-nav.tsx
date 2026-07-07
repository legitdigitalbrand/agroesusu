"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PiggyIcon, UsersIcon, ReceiptIcon, UserIcon } from "@/components/icons";

const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/save", label: "Save", icon: PiggyIcon },
  { href: "/groups", label: "Groups", icon: UsersIcon },
  { href: "/transactions", label: "Activity", icon: ReceiptIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith('/auth')) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--nav-border)",
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3.5 py-2 rounded-2xl transition-colors"
              style={{
                background: isActive ? "var(--nav-active-bg)" : "transparent",
              }}
            >
              <Icon
                className="w-[20px] h-[20px]"
                style={{
                  color: isActive ? "var(--nav-text-active)" : "var(--nav-text-inactive)",
                  strokeWidth: isActive ? 2.5 : 2,
                }}
              />
              <span
                className="text-[10px]"
                style={{
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--nav-text-active)" : "var(--nav-text-inactive)",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
