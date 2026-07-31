import React from 'react';
import Link from 'next/link';
import {
  Wallet, PiggyBank, Landmark, ShieldCheck, CheckCircle2, Clock,
} from 'lucide-react';

const mainFeatures = [
  {
    id: 'wallet',
    title: 'Instant Virtual Bank Account',
    icon: Wallet,
    color: 'bg-loam-light text-indigo border-line',
    description: 'Every registered user gets a dedicated virtual account from our banking partner. Receive bank transfers from anywhere in Nigeria to fund your wallet instantly.',
  },
  {
    id: 'savings',
    title: 'Automated Savings & Interest',
    icon: PiggyBank,
    color: 'bg-loam-light text-indigo border-line',
    description: 'Set savings goals, save consistently, and watch interest post automatically. Choose flexible savings or lock funds for higher rates.',
  },
  {
    id: 'loans',
    title: 'Savings-Backed Loans',
    icon: Landmark,
    color: 'bg-ochre-light text-indigo border-line',
    description: 'Consistent savers unlock fair credit — up to 3× their savings balance. Transparent rates, harvest-aligned repayment, no hidden charges.',
  },
  {
    id: 'security',
    title: 'Bank-Grade Security',
    icon: ShieldCheck,
    color: 'bg-loam-light text-indigo border-line',
    description: 'PIN-protected access, device verification, and deposits safeguarded by our CBN-licensed banking partner. Every transaction is encrypted.',
  },
  {
    id: 'interest',
    title: 'Competitive Interest Rates',
    icon: Clock,
    color: 'bg-ochre-light text-indigo border-line',
    description: 'Earn up to 12% p.a. on locked savings. Interest is calculated daily and posted automatically to your account.',
  },
  {
    id: 'transparency',
    title: 'Full Transparency',
    icon: CheckCircle2,
    color: 'bg-loam-light text-indigo border-line',
    description: 'Every transaction is logged and traceable. View your complete transaction history and statements at any time.',
  },
];

const valuesList = [
  'Zero hidden maintenance charges or deposit fees',
  '100% compliant with Central Bank of Nigeria guidelines',
  'Deposits safeguarded by CBN-licensed banking partner',
  'Transparent loan terms with no hidden charges',
];

export default function FeaturesPage() {
  return (
    <div className="bg-paper">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-parchment/80 to-paper py-16 md:py-24 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold text-indigo uppercase tracking-widest bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
            Platform Capabilities
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight max-w-3xl mx-auto">
            Digital Financial Tools for Nigerian Agribusiness
          </h1>
          <p className="text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Agriqcap brings modern banking technology to farmers and small businesses. 
            Save, borrow, and manage money with tools built for your success.
          </p>
        </div>
      </section>

      {/* Main Features Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mainFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.id} className="bg-paper border border-line rounded-2xl p-6 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-4">
                  <div className={`p-3 rounded-xl w-12 h-12 flex items-center justify-center shrink-0 ${feat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">{feat.title}</h3>
                  <p className="text-sm text-ink-soft leading-relaxed">{feat.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & Transparency */}
      <section className="py-20 bg-parchment border-t border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-extrabold text-ink tracking-tight">
                Designed for Absolute Security & Transparency
              </h2>
              <p className="text-base text-ink-soft leading-relaxed">
                Agriqcap respects the tradition of community trust and uses modern software 
                engineering to provide secure, transparent financial services. Every transaction 
                is logged, traceable, and protected.
              </p>
              <ul className="space-y-3">
                {valuesList.map((item, idx) => (
                  <li key={idx} className="flex items-center space-x-2 text-sm text-ink font-medium">
                    <CheckCircle2 className="h-5 w-5 text-ochre shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-paper border border-line rounded-2xl p-8 shadow-sm space-y-6">
              <h4 className="font-bold text-ink text-lg">Platform Compliance Overview</h4>
              <div className="space-y-4 text-sm text-ink-soft">
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-indigo shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-ink">MFA & Encryption</h5>
                    <p className="text-xs text-ink-soft mt-1">All transactions are encrypted. Access is secured with password and PIN authentication.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-indigo shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-ink">Deposit Protection</h5>
                    <p className="text-xs text-ink-soft mt-1">Every deposit is backed by our CBN-licensed banking partner, Safe Haven MFB.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-indigo shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-ink">KYC Verification</h5>
                    <p className="text-xs text-ink-soft mt-1">BVN and NIMC database integration prevents identity fraud and ensures secure access.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 text-center max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <h2 className="text-3xl font-extrabold text-ink">
          Ready to experience Agriqcap?
        </h2>
        <p className="text-ink-soft max-w-xl mx-auto text-sm sm:text-base">
          Sign up today and start building your financial future. Open your account in under 2 minutes.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup" className="bg-ochre text-indigo-deep py-3 px-8 text-sm font-semibold rounded-xl hover:opacity-90 transition">
            Get Started Now
          </Link>
          <Link href="/contact" className="border border-line py-3 px-8 text-sm font-semibold bg-parchment text-ink hover:bg-loam-light rounded-xl transition">
            Talk to Us
          </Link>
        </div>
      </section>
    </div>
  );
}
