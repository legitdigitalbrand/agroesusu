import React from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Users,
  LineChart,
  ShoppingBag,
  CloudSun,
  ShieldCheck,
  CheckCircle2,
  Laptop,
} from 'lucide-react';

const mainFeatures = [
  {
    id: 'ussd',
    title: 'Offline USSD Integration (*347*88#)',
    icon: Smartphone,
    color: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    description: 'No internet? No smartphone? No problem. Farmers in remote rural communities can manage their entire savings circles, check loan limits, make deposits, and execute transfers on any basic phone without data.',
  },
  {
    id: 'cooperative-portal',
    title: 'Cooperative "Esusu" Manager',
    icon: Users,
    color: 'bg-amber-50 text-amber-800 border-amber-100',
    description: 'Digitize your local cooperative contributions (Ajo). Our transparent system records member contributions, handles rotational cycles automatically, and keeps members updated via real-time SMS notifications.',
  },
  {
    id: 'automated-savings',
    title: 'Automated Harvest Savings',
    icon: LineChart,
    color: 'bg-blue-50 text-blue-800 border-blue-100',
    description: 'Set rules to automatically round up expenses or deduct weekly savings into a high-interest vault. Safely lock funds during planting and watch your capital grow with up to 15% guaranteed annual yield.',
  },
  {
    id: 'input-store',
    title: 'Verified Inputs Marketplace',
    icon: ShoppingBag,
    color: 'bg-purple-50 text-purple-800 border-purple-100',
    description: 'Purchase premium certified seeds, organic fertilizers, pesticides, and tractor rental hours directly from partnered agro-dealers using your Agriqcap wallet. Get exclusive discounts and quality guarantees.',
  },
  {
    id: 'climate-tips',
    title: 'Weather & Extension Advisory',
    icon: CloudSun,
    color: 'bg-orange-50 text-orange-800 border-orange-100',
    description: 'Get free SMS crop advice customized to your LGA (Local Government Area) in Nigeria. Receive timely weather alerts, planting advice, pest control guidelines, and market pricing updates to protect your farm.',
  },
  {
    id: 'wallet',
    title: 'Instant Virtual Bank Accounts',
    icon: Laptop,
    color: 'bg-pink-50 text-purple-800 border-pink-100',
    description: 'Every registered user gets a fully functional virtual bank account mapped to our partner bank. Receive bank transfers from anywhere in Nigeria instantly to fund your savings or settle loan balances.',
  },
];

const valuesList = [
  'Zero hidden maintenance charges or deposit fees',
  '100% compliant with Central Bank of Nigeria guidelines',
  'Multilingual support in Yoruba, Hausa, Igbo, and Pidgin English',
  'Interactive loan and interest calculators for smart planning',
];

export default function FeaturesPage() {
  return (
    <div className="bg-white">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-parchment/80 to-white py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold text-indigo uppercase tracking-widest bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
            Platform Capabilities
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Digital Financial Tools Tailored for Nigerian Agribusiness
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Agriqcap merges traditional community cooperative values with cutting-edge mobile 
            banking technology. Grow your agribusiness with tools built specifically for your success.
          </p>
        </div>
      </section>

      {/* Main Features Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mainFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.id} className="card-surface border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all hover:border-indigo/10">
                <div className="space-y-4">
                  <div className={`p-3 rounded-xl w-12 h-12 flex items-center justify-center shrink-0 ${feat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{feat.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feat.description}</p>
                </div>
                <div className="pt-6 border-t border-gray-100/50 mt-4 text-xs font-semibold text-indigo">
                  Available in mobile app & USSD
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* USSD Highlight Banner */}
      <section className="bg-indigo text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full blur-2xl animate-pulse"></div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          <span className="text-ochre bg-white/10 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Zero Internet Needed
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Dial <span className="text-ochre font-black underline">*347*88#</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-100 max-w-2xl mx-auto leading-relaxed">
            We are deeply committed to financial inclusion. Our secure USSD platform works with 
            MTN, Airtel, Glo, and 9mobile across Nigeria, giving rural farmers access to savings, 
            group rotational ledger payouts, and inputs financing instantly.
          </p>
          <div className="pt-2">
            <span className="text-xs text-gray-200 block">Works on any basic feature phone. Safe, secure, and fast.</span>
          </div>
        </div>
      </section>

      {/* Trust & Transparency */}
      <section className="py-20 bg-gray-50 border-t border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Designed for Absolute Security & Transparency
              </h2>
              <p className="text-base text-gray-600 leading-relaxed">
                Nigerian agricultural cooperatives have operated on mutual trust for centuries. 
                Agriqcap respects this legacy and uses modern software engineering to provide 
                co-guarantee features and real-time ledger records. No single individual can tamper 
                with cooperative funds.
              </p>
              <ul className="space-y-3">
                {valuesList.map((item, idx) => (
                  <li key={idx} className="flex items-center space-x-2 text-sm text-gray-700 font-medium">
                    <CheckCircle2 className="h-5 w-5 text-ochre shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm space-y-6">
              <h4 className="font-bold text-gray-900 text-lg">Platform Compliance Overview</h4>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-indigo shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-gray-900">MFA & Encryption</h5>
                    <p className="text-xs text-gray-500 mt-1">All details and account transactions are encrypted. Access is secured with PINs and OTP codes.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-indigo shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-gray-900">NDIC Deposit Insurance</h5>
                    <p className="text-xs text-gray-500 mt-1">Every deposit is backed by our banking partner, Safe Haven MFB, and is insured by the Nigerian Government.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-indigo shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-gray-900">KYC Verification</h5>
                    <p className="text-xs text-gray-500 mt-1">BVN and NIMC database integration prevents identity fraud and guarantees security across cooperative chains.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 text-center max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <h2 className="text-3xl font-extrabold text-gray-900">
          Ready to experience the power of Agriqcap?
        </h2>
        <p className="text-gray-600 max-w-xl mx-auto text-sm sm:text-base">
          Sign up today to create your individual or cooperative account. Experience modern agriculture finance.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup" className="btn-primary py-3 px-8 text-sm font-semibold">
            Get Started Now
          </Link>
          <Link href="/contact" className="btn-secondary py-3 px-8 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
            Talk to an Agent
          </Link>
        </div>
      </section>
    </div>
  );
}
