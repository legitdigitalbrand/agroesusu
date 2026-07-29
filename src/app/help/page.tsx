import { BRAND } from "@/config/brand";

export const metadata = {
  title: `Help & Support — ${BRAND.name}`,
  description: "Get help with Agriqcap.",
};

export default function HelpPage() {
  const faqs = [
    { q: "How do I create an account?", a: "Download the app or visit our website, click Get Started, and follow the signup process. You'll need your name, email, phone number, and a password." },
    { q: "How do I verify my account?", a: "After creating your account, visit the Profile section to complete verification tiers. Higher tiers unlock more features and higher transaction limits." },
    { q: "Is my money safe?", a: `Yes. All deposits are held by Safe Haven Microfinance Bank, fully licensed by the Central Bank of Nigeria (CBN). Deposits are insured by the NDIC.` },
    { q: "How do I access USSD?", a: "Dial *347*88# from any phone to access your account without internet. You can check balances, save, and apply for loans." },
    { q: "How do I contact support?", a: `Email us at ${BRAND.supportEmail} or call our support line. We're available Monday to Saturday, 8 AM to 8 PM.` },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-serif text-3xl text-ink mb-2">Help & Support</h1>
        <p className="text-sm text-ink-soft mb-8">How can we help you?</p>

        <div className="space-y-4 mb-12">
          <a href={`mailto:${BRAND.supportEmail}`} className="block bg-parchment rounded-xl p-5 hover:shadow-md transition">
            <h3 className="font-medium text-ink">Email Support</h3>
            <p className="text-sm text-ink-soft mt-1">{BRAND.supportEmail}</p>
          </a>
          <div className="bg-parchment rounded-xl p-5">
            <h3 className="font-medium text-ink">USSD Access</h3>
            <p className="text-sm text-ink-soft mt-1">Dial *347*88# from any phone</p>
          </div>
        </div>

        <h2 className="font-serif text-xl text-ink mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details key={i} className="bg-parchment rounded-xl p-5 group">
              <summary className="font-medium text-ink cursor-pointer flex items-center justify-between">
                {faq.q}
                <span className="text-ink-soft group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="text-sm text-ink-soft mt-3">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
