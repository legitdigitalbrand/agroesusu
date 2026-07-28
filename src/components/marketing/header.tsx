'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sprout, Menu, X, ArrowRight } from 'lucide-react';

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Savings', href: '/savings-plans' },
  { name: 'Loans', href: '/loan-plans' },
  { name: 'Features', href: '/features' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100 py-3'
          : 'bg-white py-4 border-b border-gray-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="bg-brand-primary p-2 rounded-xl text-white group-hover:bg-brand-primary-dark transition-colors">
              <Sprout className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold text-brand-primary tracking-tight">
              Agro<span className="text-brand-gold">Esusu</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-brand-primary ${
                    isActive ? 'text-brand-primary font-semibold' : 'text-gray-600'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-700 hover:text-brand-primary transition-colors px-3 py-2"
            >
              Login
            </Link>
            <Link href="/signup" className="btn-primary flex items-center gap-1">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-600 hover:text-brand-primary focus:outline-none p-1"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 animate-in slide-in-from-top-5 duration-200">
          <div className="px-4 pt-2 pb-6 space-y-3 sm:px-6">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-cream text-brand-primary font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-brand-primary'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
            <div className="pt-4 border-t border-gray-100 flex flex-col space-y-3 px-3">
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="text-center font-semibold text-gray-700 hover:text-brand-primary py-2"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setIsOpen(false)}
                className="btn-primary text-center justify-center flex items-center gap-2 py-3"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
