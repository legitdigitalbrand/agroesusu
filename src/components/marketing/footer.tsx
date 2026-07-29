import React from "react";
import Link from "next/link";

// Matches mockup's landing page footer
export default function Footer() {
  return (
    <footer className="flex flex-col sm:flex-row justify-between items-center px-6 md:px-10 py-5 border-t border-line text-[12px] text-ink-soft bg-paper">
      <span>© 2026 Agriqcap. All rights reserved.</span>
      <div className="flex gap-4">
        <Link href="/privacy" className="hover:text-ink transition">Privacy</Link>
        <Link href="/terms" className="hover:text-ink transition">Terms</Link>
        <Link href="/help" className="hover:text-ink transition">Contact</Link>
      </div>
    </footer>
  );
}
