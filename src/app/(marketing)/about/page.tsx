import Link from 'next/link';

export const metadata = { title: 'About Agroesusu', description: 'Democratizing agricultural finance for Nigerian farmers.' };

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-forest-green mb-4">About Agroesusu</h1>
      <p className="text-lg text-gray-600 mb-8">We're democratizing agricultural finance for Nigerian farmers.</p>

      <div className="prose max-w-none">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Our Mission</h2>
        <p className="text-gray-600 mb-6">Millions of Nigerian farmers lack access to affordable credit. Traditional banks require collateral that most farmers don't have. Agroesusu changes this by using farm data, transaction history, and BVN verification to offer instant loans — no collateral, no guarantor, no paperwork.</p>

        <h2 className="text-xl font-bold text-gray-900 mb-3">How It Works</h2>
        <p className="text-gray-600 mb-6">Our automated credit scoring engine evaluates your farm profile, transaction history, and repayment behavior to make instant loan decisions. Approved loans are disbursed to your dedicated virtual account the same day. Repayments are automated with clear schedules and reminders.</p>

        <h2 className="text-xl font-bold text-gray-900 mb-3">Our Values</h2>
        <ul className="text-gray-600 space-y-2 mb-6">
          <li><strong className="text-forest-green">Farmer-first:</strong> Every feature is designed around how farmers actually manage money.</li>
          <li><strong className="text-forest-green">Transparency:</strong> No hidden fees. Full repayment terms shown before you commit.</li>
          <li><strong className="text-forest-green">Security:</strong> Bank-grade encryption, insured deposits, PIN-protected transactions.</li>
          <li><strong className="text-forest-green">Inclusion:</strong> We serve farmers that traditional banks overlook.</li>
        </ul>

        <div className="bg-cream rounded-2xl p-6 border mt-8">
          <h3 className="font-semibold text-gray-900 mb-2">Licensing & Regulation</h3>
          <p className="text-sm text-gray-600">Agroesusu operates via a licensed partner bank. Agroesusu is not a bank — banking services (deposits, loans, transfers) are provided by our licensed banking partner. Deposits are insured. Safe Haven is a licensed banking-as-a-service provider, not the lender of record — a licensed entity actually extends credit and holds deposits.</p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link href="/signup" className="inline-block px-8 py-3 bg-forest-green text-white rounded-full font-semibold hover:bg-forest-green-dark transition">Get Started</Link>
      </div>
    </div>
  );
}
