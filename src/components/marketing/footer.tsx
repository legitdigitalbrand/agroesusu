import Link from 'next/link';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-forest-green text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-3">Agroesusu</h3>
            <p className="text-sm text-white/70">Grow your farm, grow your money. Agricultural finance built for Nigerian farmers.</p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3 text-white/90">Company</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/about" className="hover:text-white transition">About</Link></li>
              <li><Link href="/careers" className="hover:text-white transition">Careers</Link></li>
              <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
              <li><Link href="/faqs" className="hover:text-white transition">FAQs</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3 text-white/90">Products</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/loans" className="hover:text-white transition">Loans</Link></li>
              <li><Link href="/savings" className="hover:text-white transition">Savings</Link></li>
              <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
              <li><Link href="/signup" className="hover:text-white transition">Get Started</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3 text-white/90">Contact</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>Lagos, Nigeria</li>
              <li>hello@agroesusu.com</li>
              <li>+234 800 000 0000</li>
            </ul>
            <div className="flex gap-3 mt-4">
              <Link href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><Facebook size={16} /></Link>
              <Link href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><Twitter size={16} /></Link>
              <Link href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><Instagram size={16} /></Link>
              <Link href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><Linkedin size={16} /></Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4 text-xs text-white/60">
            <Link href="#" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition">Terms of Service</Link>
            <Link href="#" className="hover:text-white transition">Cookies</Link>
            <Link href="#" className="hover:text-white transition">Security</Link>
          </div>
          <p className="text-xs text-white/50">© 2026 Agroesusu. All rights reserved.</p>
        </div>

        <p className="text-xs text-white/40 mt-4">
          Agroesusu operates via a licensed partner bank. Agroesusu is not a bank — banking services are provided by our licensed partner. Deposits are insured.
        </p>
      </div>
    </footer>
  );
}
