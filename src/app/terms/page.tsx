import { BRAND } from "@/config/brand";

export const metadata = {
  title: `Terms of Service — ${BRAND.name}`,
  description: "Terms of service for Agriqcap platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl text-ink mb-2">Terms of Service</h1>
        <p className="text-sm text-ink-soft mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-ink">
          <section>
            <h2 className="font-display text-xl text-ink">1. Acceptance of Terms</h2>
            <p>By accessing or using {BRAND.name}, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">2. Description of Service</h2>
            <p>{BRAND.name} is a digital cooperative finance platform providing digital wallets, savings, loans, investments, and cooperative banking services. {BRAND.name} is a financial technology platform, not a bank. Banking services are provided by our partner bank, Safe Haven Microfinance Bank, licensed by the Central Bank of Nigeria.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">3. User Accounts</h2>
            <p>You must provide accurate and complete information when creating your account. You are responsible for maintaining the security of your account and PIN.</p>
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
            <p>{BRAND.name} is provided "as is" without warranties of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the platform.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">7. Contact</h2>
            <p>For questions about these terms, contact us at {BRAND.supportEmail}.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
