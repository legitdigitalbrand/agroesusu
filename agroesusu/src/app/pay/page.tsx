import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHero, PageBody } from '@/components/ui/page-hero';
import { formatNaira } from '@/lib/utils';
import { PhoneIcon, WifiIcon, TvIcon, BoltIcon, ArrowUpRightIcon } from '@/components/icons';

export default async function PayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Fetch user's Safe Haven virtual account for debit
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, kyc_status, bvn_verified')
    .eq('id', user.id)
    .single();

  const isSafeHaven = process.env.PAYMENT_PROVIDER === 'safehaven';

  const services = [
    {
      href: '/pay/airtime',
      Icon: PhoneIcon,
      name: 'Airtime',
      desc: 'Top up any phone number',
      available: true,
    },
    {
      href: '/pay/data',
      Icon: WifiIcon,
      name: 'Data',
      desc: 'Buy data bundles',
      available: true,
    },
    {
      href: '/pay/cable',
      Icon: TvIcon,
      name: 'Cable TV',
      desc: 'DStv, GOtv, Startimes',
      available: true,
    },
    {
      href: '/pay/bills',
      Icon: BoltIcon,
      name: 'Electricity',
      desc: 'Pay utility bills',
      available: true,
    },
    {
      href: '/withdraw',
      Icon: ArrowUpRightIcon,
      name: 'Transfer',
      desc: 'Send money to any bank',
      available: true,
    },
  ];

  return (
    <div>
      <PageHero>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--hero-pill-bg)" }}>PAYMENTS</p>
            <h1 className="text-xl font-bold mt-0.5" style={{ color: "var(--hero-text)" }}>Pay</h1>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--hero-text-muted)" }}>
          Buy airtime, data, pay bills, and transfer — all in one place.
        </p>
      </PageHero>

      <PageBody>
        {/* Trust badge */}
        <div className="rounded-xl p-3 mb-5 border flex items-center gap-2" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            🔒 Payments powered by Safe Haven MFB — a CBN-licensed and NDIC-insured microfinance bank.
          </span>
        </div>

        {/* Service tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {services.map((svc) => {
            const Icon = svc.Icon;
            return (
              <Link
                key={svc.name}
                href={svc.href}
                className="rounded-xl p-4 border transition hover:opacity-80"
                style={{
                  background: "var(--surface-card)",
                  borderColor: "var(--border-default)",
                  opacity: svc.available ? 1 : 0.4,
                  pointerEvents: svc.available ? 'auto' : 'none',
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--pot-icon-bg)" }}>
                  <Icon style={{ width: 20, height: 20, color: "var(--qa-icon-color)" }} />
                </div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{svc.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{svc.desc}</p>
              </Link>
            );
          })}
        </div>

        {!isSafeHaven && (
          <div className="rounded-xl p-4 border" style={{ background: "rgba(201,137,31,0.08)", borderColor: "rgba(201,137,31,0.3)" }}>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <strong>Note:</strong> Bill payments and airtime require Safe Haven MFB as the payment provider. 
              Set <code className="px-1 py-0.5 rounded" style={{ background: "var(--input-bg)" }}>PAYMENT_PROVIDER=safehaven</code> to enable these features.
              Transfers remain available via Paystack.
            </p>
          </div>
        )}
      </PageBody>
    </div>
  );
}
