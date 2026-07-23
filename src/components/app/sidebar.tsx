'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Banknote, PiggyBank, Wallet, Receipt,
  ArrowLeftRight, CreditCard, Gift, User, Bell, LifeBuoy, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/loans', label: 'Loans', icon: Banknote },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/pay', label: 'Pay Bills', icon: Receipt },
  { href: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { href: '/cards', label: 'Cards', icon: CreditCard },
  { href: '/referrals', label: 'Referrals', icon: Gift },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/support', label: 'Support', icon: LifeBuoy },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-screen w-64 bg-forest-green text-white z-50 flex flex-col transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight">
            Agroesusu
          </Link>
          <button
            className="lg:hidden text-white/70 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/50">
            Licensed partner bank deposits insured.
          </p>
        </div>
      </aside>

      {/* Mobile menu trigger button — rendered in topbar instead */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-forest-green text-white"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </>
  );
}
