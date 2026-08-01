"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

import { Menu, X } from "lucide-react";
import { LogoMark } from "@/components/yield";

// Matches mockup's landing page nav bar
const navLinks = [
  { name: "Features", href: "/#features" },
  { name: "How it works", href: "/#how" },
  { name: "Savings & Loans", href: "/#savings" },
  { name: "Contact", href: "/#contact" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "bg-paper/95 backdrop-blur-md shadow-sm border-b border-line py-3"
          : "bg-paper py-4 border-b border-line"
      }`}
    >
      <div className="max-w-[1180px] mx-auto px-6 md:px-10 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-display font-medium text-[17px] tracking-tight text-ink">
            Agriqcap
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex gap-6 text-[13px] text-ink-soft">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href} className="hover:text-ink transition">
              {link.name}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3.5">
          <Link href="/login" className="text-[13px] text-ink font-medium hover:text-indigo transition">
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-ochre text-ink font-semibold text-[13px] px-5 py-2.5 rounded-[10px] hover:opacity-90 transition"
          >
            Get started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-ink"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {isOpen && (
        <div className="md:hidden bg-paper border-t border-line px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="block text-[14px] text-ink-soft hover:text-ink transition"
              onClick={() => setIsOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <div className="flex gap-3 pt-2 border-t border-line">
            <Link
              href="/login"
              className="flex-1 text-center text-[13px] text-ink font-medium border border-line py-2.5 rounded-[10px]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="flex-1 text-center bg-ochre text-ink font-semibold text-[13px] py-2.5 rounded-[10px]"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
