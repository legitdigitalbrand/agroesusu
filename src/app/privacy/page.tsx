import { BRAND } from "@/config/brand";

export const metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
  description: "Privacy policy for Agriqcap platform.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-serif text-3xl text-ink mb-2">Privacy Policy</h1>
        <p className="text-sm text-ink-soft mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-ink">
          <section>
            <h2 className="font-serif text-xl text-ink">1. Information We Collect</h2>
            <p>We collect information you provide directly: name, email, phone number, BVN, NIN, and financial transaction data. We also collect device and usage information.</p>
          </section>
          <section>
            <h2 className="font-serif text-xl text-ink">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve our services, verify your identity, process transactions, comply with regulatory requirements, and prevent fraud.</p>
          </section>
          <section>
            <h2 className="font-serif text-xl text-ink">3. Data Security</h2>
            <p>We implement industry-standard security measures including encryption, access controls, and audit logging. Your financial data is stored securely and access is restricted to authorized personnel only.</p>
          </section>
          <section>
            <h2 className="font-serif text-xl text-ink">4. Data Sharing</h2>
            <p>We share data with our partner bank (Safe Haven Microfinance Bank) and regulatory authorities (CBN, NDIC) as required by law. We never sell your personal data.</p>
          </section>
          <section>
            <h2 className="font-serif text-xl text-ink">5. Your Rights</h2>
            <p>You have the right to access, correct, or request deletion of your personal data. Contact us at {BRAND.supportEmail} to exercise these rights.</p>
          </section>
          <section>
            <h2 className="font-serif text-xl text-ink">6. Contact</h2>
            <p>For privacy questions, contact us at {BRAND.supportEmail}.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
