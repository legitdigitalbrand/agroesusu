import React from 'react';
import Link from 'next/link';
import { Sprout, Users, Lock, Wallet, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

const plans = [
  {
    id: 'cooperative',
    name: 'Cooperative "Esusu"',
    tagline: 'Save with your farming association or cooperative group.',
    interest: '12% per annum',
    payout: 'Rotational or collective',
    icon: Users,
    color: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    iconColor: 'bg-emerald-100 text-emerald-700',
    description: 'Perfect for local farm groups, cluster farmers, and market unions. Save together, track each member\'s ledger online, and easily access joint lending options with collective accountability.',
    features: [
      'Digital ledger for all group members',
      'Transparency in rotational payouts (Ajo/Esusu)',
      'No paperwork or monthly group admin fees',
      'Unlocks higher collective borrowing capacity',
    ],
  },
  {
    id: 'harvest-lock',
    name: 'Harvest Lock (Fixed Deposit)',
    tagline: 'Lock capital during planting, unlock with high interest at harvest.',
    interest: 'Up to 15% per annum',
    payout: 'At contract maturity',
    icon: Lock,
    color: 'bg-amber-50 text-amber-800 border-amber-100',
    iconColor: 'bg-amber-100 text-amber-700',
    description: 'Protect your farming revenues. Lock seed funds or sales cash for 3, 6, or 9 months matching your crop growth cycle. Earn some of the most competitive, guaranteed interest rates in Nigeria.',
    features: [
      'Aligned with actual planting/harvest calendars',
      'No monthly maintenance fees',
      'Automatic or manual rollover options',
      'Guaranteed high-yield returns',
    ],
  },
  {
    id: 'personal-target',
    name: 'Personal Agro Target',
    tagline: 'Save towards specific farming assets or expenses.',
    interest: '10% per annum',
    payout: 'Flexible upon goal completion',
    icon: Sprout,
    color: 'bg-blue-50 text-blue-800 border-blue-100',
    iconColor: 'bg-blue-100 text-blue-700',
    description: 'Planning to buy high-yield fertilizers, purchase hybrid seeds, or rent a tractor next season? Set a target, configure automated daily/weekly contributions, and earn high interest as you save.',
    features: [
      'Automated daily, weekly, or monthly savings',
      'Withdrawals unlocked once target is achieved',
      'Track progress directly on the mobile app',
      'Add family members or farm hands to co-save',
    ],
  },
  {
    id: 'group-wallet',
    name: 'Esusu Group Wallet',
    tagline: 'Flexible deposit accounts for agribusiness cooperatives.',
    interest: '8% per annum',
    payout: 'Immediate access',
    icon: Wallet,
    color: 'bg-purple-50 text-purple-800 border-purple-100',
    iconColor: 'bg-purple-100 text-purple-700',
    description: 'An open savings wallet for small agri-cooperatives, local unions, and trade groups. Withdraw funds at any point for emergency input needs, member welfare issues, or logistics payments.',
    features: [
      'Instant penalty-free withdrawals',
      'Unlimited deposits via virtual account number',
      'Monthly interests credited automatically',
      'Detailed downloadable statement of account',
    ],
  },
];

const safetyGuarantees = [
  {
    title: 'Bank-Grade Security',
    desc: 'We utilize state-of-the-art encryption protocols to protect your personal and financial information. Your transactions are secure with multi-factor authentication.',
  },
  {
    title: 'Regulated Custodians',
    desc: 'All AgroEsusu user deposits are held by Safe Haven Microfinance Bank, fully licensed by the Central Bank of Nigeria (CBN).',
  },
  {
    title: 'NDIC Insured',
    desc: 'Your active balances and locked deposits are insured by the Nigeria Deposit Insurance Corporation (NDIC), ensuring your capital is completely safe.',
  },
];

export default function SavingsPlansPage() {
  return (
    <div className="bg-white">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-parchment/80 to-white py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-sm font-bold text-indigo uppercase tracking-widest bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
            AgroEsusu Wealth
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Agricultural Savings Plans Built to Multiply Your Wealth
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Choose from cooperative rotational circles, target-based planners, or locked high-yield deposits. 
            Automated, secure, and aligned with the Nigerian farming season.
          </p>
        </div>
      </section>

      {/* Savings Plans Showcase */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {plans.map((plan) => {
            const IconComponent = plan.icon;
            return (
              <div
                key={plan.id}
                className="card-surface flex flex-col justify-between border border-gray-100 hover:border-indigo/20 hover:shadow-lg transition-all"
              >
                <div className="space-y-6">
                  {/* Badge & Title */}
                  <div className="flex items-center justify-between">
                    <div className={`${plan.iconColor} p-3 rounded-2xl`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <span className={`text-xs font-bold border px-3 py-1 rounded-full ${plan.color}`}>
                      Interest: {plan.interest}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-ochre-dim font-medium">{plan.tagline}</p>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed">{plan.description}</p>

                  {/* Feature Checklist */}
                  <div className="space-y-2.5 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Highlights</p>
                    <ul className="space-y-2">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-sm text-gray-600">
                          <CheckCircle2 className="h-4.5 w-4.5 text-indigo shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card footer CTAs */}
                <div className="pt-8 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    <span className="block font-semibold">Payout Frequency:</span>
                    <span className="text-gray-700">{plan.payout}</span>
                  </div>
                  <Link
                    href={`/signup?plan=${plan.id}`}
                    className="btn-primary flex items-center gap-1 bg-indigo hover:bg-indigo-deep font-bold text-sm px-5 py-2.5 rounded-lg"
                  >
                    Start Saving <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security & Regulatory Backing */}
      <section className="bg-gray-50 py-20 border-t border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Your Funds are 100% Secure
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              We prioritize the safety of your agricultural hard-earned money. AgroEsusu is built on 
              strict security and regulatory-compliant foundations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {safetyGuarantees.map((item, idx) => (
              <div key={idx} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="bg-indigo/10 text-indigo w-10 h-10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-lg text-gray-900">{item.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Call-out CTA */}
      <section className="py-20 text-center max-w-4xl mx-auto px-4 sm:px-6">
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Have questions about our savings plans?
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto text-sm sm:text-base">
            Check out our comprehensive FAQ page or get in touch with our agricultural customer success team 
            available 24/7 in English, Yoruba, Hausa, Igbo, and Pidgin.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/faqs" className="btn-secondary bg-parchment text-indigo-deep border border-indigo/10 py-3 px-6 hover:bg-indigo/5 font-semibold text-sm">
              Read FAQs
            </Link>
            <Link href="/signup" className="btn-primary py-3 px-6 font-semibold text-sm">
              Sign Up Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
