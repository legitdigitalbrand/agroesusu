import React from 'react';
import Link from 'next/link';
import { Sprout, Shield, Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 pt-16 pb-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center space-x-2">
              <div className="bg-indigo p-2 rounded-xl text-white">
                <Sprout className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Agriq<span className="text-ochre">cap</span>
              </span>
            </Link>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
              Agriqcap is Nigeria's leading agricultural savings and lending platform. 
              We empower farmers, cooperatives, and agro-businesses with digital tools 
              to save together, earn competitive interest, and access affordable credit.
            </p>
            {/* Social Links */}
            <div className="flex space-x-4">
              <Link href="#" className="p-2 bg-gray-800 hover:bg-indigo rounded-lg text-gray-400 hover:text-white transition-all">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="p-2 bg-gray-800 hover:bg-indigo rounded-lg text-gray-400 hover:text-white transition-all">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="p-2 bg-gray-800 hover:bg-indigo rounded-lg text-gray-400 hover:text-white transition-all">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="p-2 bg-gray-800 hover:bg-indigo rounded-lg text-gray-400 hover:text-white transition-all">
                <Linkedin className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Quick Links: Solutions */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Solutions</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/savings-plans" className="hover:text-white transition-colors">
                  Savings Plans
                </Link>
              </li>
              <li>
                <Link href="/loan-plans" className="hover:text-white transition-colors">
                  Loan Plans
                </Link>
              </li>
              <li>
                <Link href="/features" className="hover:text-white transition-colors">
                  Platform Features
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links: Company */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">
                  Blog & News
                </Link>
              </li>
              <li>
                <Link href="/faqs" className="hover:text-white transition-colors">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links: Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-ochre mt-0.5 shrink-0" />
                <span className="text-gray-400">8 Adeola Hopewell St, Victoria Island, Lagos, Nigeria</span>
              </li>
              <li className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-ochre shrink-0" />
                <span className="text-gray-400">+234 (0) 1 234 5678</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-ochre shrink-0" />
                <span className="text-gray-400">support@agriqcap.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Regulatory & Partner Badges */}
        <div className="border-t border-gray-800 pt-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Safe Haven MFB partner badge */}
          <div className="flex items-center space-x-3 bg-gray-800/60 border border-gray-800 px-4 py-3 rounded-xl max-w-md">
            <Shield className="h-8 w-8 text-ochre shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-white block">Banking Services Partner</span>
              <p className="text-gray-400 mt-0.5">
                Funds are held with our partner bank, <strong className="text-ochre">Safe Haven Microfinance Bank</strong>, 
                licensed by the Central Bank of Nigeria (CBN) and fully insured by the NDIC.
              </p>
            </div>
          </div>

          <div className="text-center md:text-right text-xs text-gray-500 max-w-sm">
            <p>
              Agriqcap is a financial technology platform, not a bank. 
              Savings plans interest rates are subject to market conditions. 
              Loans are subject to credit assessments.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 mt-6 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500">
          <p>© {currentYear} Agriqcap. All rights reserved.</p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Link href="#" className="hover:text-gray-400">Privacy Policy</Link>
            <Link href="#" className="hover:text-gray-400">Terms of Service</Link>
            <Link href="#" className="hover:text-gray-400">CBN/NDIC Disclosures</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
