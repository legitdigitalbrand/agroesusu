import Link from "next/link";
import { BRAND } from "@/config/brand";

export const metadata = {
  title: `Terms of Service — ${BRAND.name}`,
  description: "Terms of service for AgroPocket platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-indigo-deep text-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-ochre flex items-center justify-center font-display font-extrabold text-indigo-deep">A</span>
            <span className="font-display font-bold tracking-tight text-[16px]">{BRAND.name}</span>
          </Link>
          <Link href="/" className="text-[13px] text-white/70 hover:text-white transition">
            ← Back to home
          </Link>
        </div>
        <div className="h-1 bg-ochre" />
      </header>

      <div className="max-w-3xl w-full mx-auto px-6 py-12 flex-1">
        <div className="rounded-2xl border border-line bg-parchment/50 p-6 sm:p-9 mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink mb-2">Terms of Service</h1>
          <p className="text-sm text-ink-soft mb-0">
            Last updated: July 2026 · {BRAND.legalName}
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-ink">
          <section>
            <h2 className="font-display text-xl text-ink">1. Acceptance of Terms</h2>
            <p>By accessing or using {BRAND.name}, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">2. Description of Service</h2>
            <p>{BRAND.name} is a digital cooperative finance platform providing digital wallets, savings, loans, investments, and cooperative banking services. {BRAND.name} is a financial technology platform, not a bank. Banking services are provided by our partner bank, Safe Haven Microfinance Bank, licensed by the Central Bank of Nigeria.</p></section><section>{/* LEGAL INFORMATION REQUIRED: CAC/RC registration number and registered address for Agro Pocket Limited are pending — add to this section once provided. */}<p>{BRAND.name} is operated by {BRAND.legalName}. {BRAND.name} is a financial technology platform, not a bank. Banking services are provided by our partner bank, Safe Haven Microfinance Bank, licensed by the Central Bank of Nigeria.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">3. User Accounts</h2>
            <p>You must provide accurate and complete information when creating your account. You are responsible for maintaining the security of your account and password.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">4. Eligibility</h2>
            <p>You must be at least 18 years old and a resident of Nigeria to use {BRAND.name}. Certain features may require additional verification (KYC).</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">5. Prohibited Conduct</h2>
            <p>You agree not to use {BRAND.name} for any illegal activities, including money laundering, fraud, or terrorism financing. All transactions are monitored for compliance.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">6. Limitation of Liability</h2>
            <p>{BRAND.name} is provided &quot;as is&quot; without warranties of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the platform.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">7. Contact</h2>
            <p>For questions about these terms, contact us at {BRAND.supportEmail}.</p>
          </section>
        </div>
      </div>

      <footer className="border-t border-line bg-parchment/50">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-ink-soft">
          <span>{BRAND.copyright}</span>
          <span className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-ink transition">Terms</Link>
            <Link href="/privacy" className="hover:text-ink transition">Privacy</Link>
            <Link href="/help" className="hover:text-ink transition">Help</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
