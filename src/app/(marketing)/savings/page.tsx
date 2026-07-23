import Link from 'next/link';
import { PiggyBank, Users, Lock } from 'lucide-react';

export default function SavingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-forest-green mb-4">Savings & Esusu</h1>
      <p className="text-lg text-gray-600 mb-12">Save smarter with traditional esusu circles and fixed deposits — all digital, all insured.</p>
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="p-6 bg-white rounded-2xl border">
          <Users className="text-forest-green mb-3" size={28} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Esusu Circles</h2>
          <p className="text-gray-600 text-sm mb-4">The traditional rotating savings system, reimagined for the digital age. Create a circle with trusted farmers, set contribution amounts and frequency, and take turns receiving the pool.</p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• 2–20 members per circle</li>
            <li>• Daily, weekly, or monthly contributions</li>
            <li>• Automatic rotation tracking</li>
            <li>• Transparent payout order</li>
          </ul>
        </div>
        <div className="p-6 bg-white rounded-2xl border">
          <Lock className="text-forest-green mb-3" size={28} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Fixed Deposits</h2>
          <p className="text-gray-600 text-sm mb-4">Lock away funds and earn competitive interest. Perfect for saving between harvest seasons or building capital for farm expansion.</p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Up to 12% per annum</li>
            <li>• 30 to 365 day terms</li>
            <li>• Insured deposits</li>
            <li>• Instant withdrawal at maturity</li>
          </ul>
        </div>
      </div>
      <div className="bg-forest-green text-white rounded-2xl p-8 text-center">
        <PiggyBank className="mx-auto mb-4 opacity-80" size={32} />
        <h2 className="text-xl font-bold mb-2">Start saving today</h2>
        <p className="text-white/80 mb-4">Join thousands of farmers building their financial future with Agroesusu.</p>
        <Link href="/signup" className="inline-block px-6 py-3 bg-white text-forest-green rounded-full font-semibold hover:bg-white/90 transition">Get Started</Link>
      </div>
    </div>
  );
}
