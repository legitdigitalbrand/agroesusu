import Link from "next/link";
import { BRAND } from "@/config/brand";

export const metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
  description: "Privacy policy for AgroPocket platform.",
};

export default function PrivacyPage() {
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
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink mb-2">Privacy Policy</h1>
          <p className="text-sm text-ink-soft mb-0">
            Last updated: July 2026 · {BRAND.legalName}
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-ink">
          <section>
            <h2 className="font-display text-xl text-ink">1. Information We Collect</h2>{/* LEGAL INFORMATION REQUIRED: CAC/RC registration number and registered address for Agro Pocket Limited are pending — add to this section once provided. */}<p>{BRAND.legalName} operates {BRAND.name} and is responsible for the personal data described in this policy.</p>
            <p>We collect information you provide directly: name, email, phone number, BVN, NIN, and financial transaction data. We also collect device and usage information.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve our services, verify your identity, process transactions, comply with regulatory requirements, and prevent fraud.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">3. Data Security</h2>
            <p>We implement industry-standard security measures including encryption, access controls, and audit logging. Your financial data is stored securely and access is restricted to authorized personnel only.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">4. Data Sharing</h2>
            <p>We share data with our partner bank (Safe Haven Microfinance Bank) and regulatory authorities (CBN, NDIC) as required by law. We never sell your personal data.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">5. Your Rights</h2>
            <p>You have the right to access, correct, or request deletion of your personal data. Contact us at {BRAND.supportEmail} to exercise these rights.</p>
          </section>
          <section>
            <h2 className="font-display text-xl text-ink">6. Contact</h2>
            <p>For privacy questions, contact us at {BRAND.supportEmail}.</p>
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
