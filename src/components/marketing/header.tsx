'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-forest-green/10">
      <nav className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-forest-green tracking-tight">
          Agroesusu
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-8">
          <Link href="/loan-plans" className="text-sm font-medium text-gray-700 hover:text-forest-green transition">Loans</Link>
          <Link href="/savings-plans" className="text-sm font-medium text-gray-700 hover:text-forest-green transition">Savings</Link>
          <Link href="/features" className="text-sm font-medium text-gray-700 hover:text-forest-green transition">Features</Link>
          <div
            className="relative"
            onMouseEnter={() => setCompanyOpen(true)}
            onMouseLeave={() => setCompanyOpen(false)}
          >
            <button className="text-sm font-medium text-gray-700 hover:text-forest-green transition flex items-center gap-1">
              Company <ChevronDown size={14} />
            </button>
            {companyOpen && (
              <div className="absolute top-full left-0 pt-2">
                <div className="bg-white rounded-xl shadow-lg border p-2 w-48 space-y-1">
                  <Link href="/about" className="block px-3 py-2 text-sm text-gray-600 hover:bg-cream rounded-lg transition">About</Link>
                  <Link href="/careers" className="block px-3 py-2 text-sm text-gray-600 hover:bg-cream rounded-lg transition">Careers</Link>
                  <Link href="/blog" className="block px-3 py-2 text-sm text-gray-600 hover:bg-cream rounded-lg transition">Blog</Link>
                  <Link href="/faqs" className="block px-3 py-2 text-sm text-gray-600 hover:bg-cream rounded-lg transition">FAQs</Link>
                  <Link href="/contact" className="block px-3 py-2 text-sm text-gray-600 hover:bg-cream rounded-lg transition">Contact</Link>
                </div>
              </div>
            )}
          </div>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-forest-green transition">Login</Link>
          <Link href="/signup" className="px-5 py-2 bg-forest-green text-white rounded-full text-sm font-medium hover:bg-forest-green-dark transition">
            Get Started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="lg:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t bg-cream px-4 py-4 space-y-2">
          <Link href="/loan-plans" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">Loans</Link>
          <Link href="/savings-plans" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">Savings</Link>
          <Link href="/features" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">Features</Link>
          <Link href="/about" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">About</Link>
          <Link href="/careers" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">Careers</Link>
          <Link href="/blog" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">Blog</Link>
          <Link href="/faqs" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">FAQs</Link>
          <Link href="/contact" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">Contact</Link>
          <div className="pt-2 flex gap-3">
            <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 py-2 text-center text-sm font-medium text-forest-green border border-forest-green rounded-full">Login</Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)} className="flex-1 py-2 text-center text-sm font-medium text-white bg-forest-green rounded-full">Get Started</Link>
          </div>
        </div>
      )}
    </header>
  );
}
