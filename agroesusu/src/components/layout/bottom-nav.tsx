"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HomeIcon, PiggyIcon, UsersIcon, ReceiptIcon, UserIcon } from "@/components/icons";

const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/save", label: "Save", icon: PiggyIcon },
  { href: "/groups", label: "Groups", icon: UsersIcon, raised: true },
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
      <div className="flex items-end justify-around px-2 pt-2.5 pb-2.5 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.raised) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-3 -mt-6"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--hero-pill-bg)",
                    boxShadow: "0 8px 18px -4px rgba(4, 251, 70, 0.5)",
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: "var(--hero-pill-text)" }} />
                </div>
                <span
                  className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}
                  style={{ color: isActive ? "var(--nav-text-active)" : "var(--nav-text-inactive)" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1.5"
            >
              <Icon
                className="w-[22px] h-[22px]"
                style={{
                  color: isActive ? "var(--nav-text-active)" : "var(--nav-text-inactive)",
                  strokeWidth: isActive ? 2.5 : 2,
                }}
              />
              <span
                className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}
                style={{
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
