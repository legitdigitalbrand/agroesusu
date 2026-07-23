import Link from 'next/link';
import { Wallet, Receipt, Gift, CreditCard, Bell, Shield } from 'lucide-react';

export default function FeaturesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-forest-green mb-4">Features</h1>
      <p className="text-lg text-gray-600 mb-12">Everything you need to manage your farm finances in one place.</p>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl border p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-forest-green/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Wallet className="text-forest-green" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Agroesusu Account</h2>
              <p className="text-gray-600 mb-3">Send and receive money instantly with your dedicated virtual account. Get real-time notifications for every transaction.</p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Dedicated virtual account number for every user</li>
                <li>• Instant transfers to any Nigerian bank</li>
                <li>• Real-time transaction notifications</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-forest-green/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Receipt className="text-forest-green" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pay Bills & Buy Farm Inputs</h2>
              <p className="text-gray-600 mb-3">Pay for seeds, fertilizer, agro-dealers, irrigation, veterinary services, airtime, data, and electricity — all from your account.</p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Farm input vendors: Seed Co., Notore, Dizengoff, and more</li>
                <li>• Airtime & data: MTN, Airtel, Glo, 9mobile</li>
                <li>• One-time or recurring bill payments</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-forest-green/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Gift className="text-forest-green" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Referrals & Rewards</h2>
              <p className="text-gray-600 mb-3">Earn bonuses when you refer other farmers. Unlock badges for borrowing, saving, and spending on your farm.</p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Earn referral bonuses when referees take their first loan</li>
                <li>• Unlock badges: First Loan, Saver, Influencer, Big Spender</li>
                <li>• Boost your credit score with active usage</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-forest-green/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <CreditCard className="text-forest-green" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Cards</h2>
              <p className="text-gray-600 mb-3">Get a virtual or physical card to pay anywhere in Nigeria. Using your card regularly boosts your loan approval odds.</p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Virtual card for online payments</li>
                <li>• Physical card for in-store purchases</li>
                <li>• Card usage improves loan eligibility</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-forest-green text-white rounded-2xl p-8 text-center">
          <Shield className="mx-auto mb-4 opacity-80" size={32} />
          <h2 className="text-xl font-bold mb-2">Bank-grade security</h2>
          <p className="text-white/80 mb-4">Your data is encrypted, your deposits are insured, and every transaction requires your PIN.</p>
          <Link href="/signup" className="inline-block px-6 py-3 bg-white text-forest-green rounded-full font-semibold hover:bg-white/90 transition">Get Started</Link>
        </div>
      </div>
    </div>
  );
}
