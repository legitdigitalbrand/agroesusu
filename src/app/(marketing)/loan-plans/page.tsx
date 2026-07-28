import React from 'react';
import Link from 'next/link';
import { Sprout, Users, Tractor, ShoppingBag, ArrowRight, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';

const loanTypes = [
  {
    id: 'inputs',
    name: 'Seed & Input Financing',
    tagline: 'Get high-quality crop inputs ahead of the planting season.',
    rate: '1.5% monthly',
    amountRange: '₦50,000 – ₦300,000',
    term: 'Up to 6 Months',
    icon: Sprout,
    iconBg: 'bg-emerald-100 text-emerald-800',
    description: 'Designed for individual farmers to purchase certified seeds, crop protection, and premium fertilizers. Avoid price surges by procuring inputs early before rains begin.',
    features: [
      'Fast-track approval within 48 hours',
      'Direct disbursement to verified agro-dealers or farm wallets',
      'No collateral required for verified AgroEsusu users',
      'Flexible repayment matching harvest calendars',
    ],
  },
  {
    id: 'cooperative',
    name: 'Cooperative Joint Loan',
    tagline: 'Leverage the collective power of your cooperative society.',
    rate: '1.2% monthly',
    amountRange: '₦500,000 – ₦5,000,000',
    term: '3 to 12 Months',
    icon: Users,
    iconBg: 'bg-amber-100 text-amber-800',
    description: 'Specialized group credit where members co-guarantee each other. This collective backing allows cooperatives to secure larger funding volumes with lower interest rates.',
    features: [
      'Extremely low interest rate',
      'Shared group accountability limits individual defaults',
      'Funds can be distributed or spent on collective machines',
      'Mentorship & training included from AgroEsusu extension officers',
    ],
  },
  {
    id: 'machinery',
    name: 'Agro-Machinery & Equipment Lease',
    tagline: 'Mechanize your operations to boost efficiency and crop yield.',
    rate: '1.8% monthly',
    amountRange: '₦250,000 – ₦2,000,000',
    term: '6 to 18 Months',
    icon: Tractor,
    iconBg: 'bg-blue-100 text-blue-800',
    description: 'Tractor rental, irrigation setup, drone spraying, or post-harvest processing machinery. Stop using manual labor when you can mechanize your acreage cost-effectively.',
    features: [
      'Lease-to-own equipment financing options',
      'Flexible terms extended across multiple harvesting seasons',
      'Equipment insurance included in loan package',
      'Maintenance support from our mechanical partners',
    ],
  },
  {
    id: 'trade',
    name: 'Off-taker & Trade Finance',
    tagline: 'Bridge your inventory and logistics cash flow constraints.',
    rate: '2.0% monthly',
    amountRange: '₦1,000,000 – ₦10,000,000',
    term: '30 to 90 Days',
    icon: ShoppingBag,
    iconBg: 'bg-purple-100 text-purple-800',
    description: 'Tailored for grain aggregators, food merchants, processors, and agro-exporters. Pay farmers instantly at harvest, sort transport logistics, and sell to corporate off-takers.',
    features: [
      'Very short-term, high-turnover financing',
      'Purchase-order (PO) backed funding options',
      'Fast, direct wire transfers to manage supplier payments',
      'Custom limits that scale with your trading history',
    ],
  },
];

const steps = [
  {
    num: '1',
    title: 'Register Profile',
    desc: 'Download the app or sign up. Provide basic details and verify your BVN (Bank Verification Number).',
  },
  {
    num: '2',
    title: 'Join a Circle or Cooperative',
    desc: 'Individual farmers can join existing AgroEsusu groups or verify their farm status to qualify for individual input loans.',
  },
  {
    num: '3',
    title: 'Select & Apply',
    desc: 'Choose a loan plan, enter your requested amount, and select your flexible repayment term.',
  },
  {
    num: '4',
    title: 'Farm Validation',
    desc: 'Our digital agent or local cooperative head verifies your farm plot using satellite mapping or physical visitation.',
  },
  {
    num: '5',
    title: 'Instant Payout',
    desc: 'Approved loans are credited to your virtual wallet or sent directly to input suppliers within 3-5 working days.',
  },
];

export default function LoanPlansPage() {
  return (
    <div className="bg-white">
      {/* Header Banner */}
      <section className="bg-gradient-to-b from-brand-cream/80 to-white py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-sm font-bold text-brand-gold uppercase tracking-widest bg-brand-gold/10 px-4 py-1.5 rounded-full border border-brand-gold/20">
            Agricultural Credit
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Affordable Agricultural Loans with Zero Predatory Fees
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            From crop inputs and tractor rentals to wholesale trade finance. 
            Flexible repayment terms customized to match your actual harvest cycles.
          </p>
        </div>
      </section>

      {/* Loan Plans Cards Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {loanTypes.map((loan) => {
            const Icon = loan.icon;
            return (
              <div key={loan.id} className="card-surface flex flex-col justify-between border border-gray-100 hover:border-brand-primary/20 hover:shadow-lg transition-all">
                <div className="space-y-6">
                  {/* Badge & Rate */}
                  <div className="flex items-center justify-between">
                    <div className={`${loan.iconBg} p-3 rounded-2xl`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-full">
                      Rate: {loan.rate}
                    </span>
                  </div>

                  {/* Copy */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900">{loan.name}</h3>
                    <p className="text-sm text-brand-gold-dark font-medium">{loan.tagline}</p>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed">{loan.description}</p>

                  {/* Financial Stats Bar */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Funding Limits</span>
                      <span className="text-sm font-bold text-gray-900">{loan.amountRange}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Repayment Term</span>
                      <span className="text-sm font-bold text-gray-900">{loan.term}</span>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2.5 pt-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Credit Benefits</p>
                    <ul className="space-y-2">
                      {loan.features.map((feat, index) => (
                        <li key={index} className="flex items-start space-x-2 text-sm text-gray-600">
                          <CheckCircle2 className="h-4.5 w-4.5 text-brand-gold shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card CTA */}
                <div className="pt-8 border-t border-gray-100 mt-6 flex justify-end">
                  <Link href={`/signup?type=${loan.id}`} className="btn-primary flex items-center gap-2">
                    Apply for this Loan <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5-Step Application Process */}
      <section className="bg-brand-primary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-bold text-brand-gold bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest">
              Simple Application
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Our 5-Step Digital Lending Process
            </h2>
            <p className="text-sm sm:text-base text-gray-100">
              No long queues or endless stacks of collateral paper. AgroEsusu brings quick, 
              accountable agricultural lending directly to your fingertips.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
            {steps.map((step, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-6 relative flex flex-col justify-between">
                <span className="text-4xl font-extrabold text-brand-gold/30 block mb-4">{step.num}</span>
                <div>
                  <h4 className="font-bold text-base text-brand-gold mb-2">{step.title}</h4>
                  <p className="text-xs text-gray-300 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ call-out or guarantee */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <div className="mx-auto bg-brand-gold/10 text-brand-gold w-12 h-12 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Trustworthy Credit Backed by Partners
        </h2>
        <p className="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
          AgroEsusu ensures all credit products comply fully with Central Bank of Nigeria guidelines. 
          We work closely with local crop insurance providers to offer weather index insurance, protecting 
          you against drought, crop disease, and flash flooding.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/contact" className="btn-secondary bg-gray-100 text-gray-700 hover:bg-gray-200">
            Contact Loan Officer
          </Link>
          <Link href="/signup" className="btn-primary">
            Apply Now
          </Link>
        </div>
      </section>
    </div>
  );
}
