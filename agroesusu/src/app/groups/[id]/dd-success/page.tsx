import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyAndCreditGroupContribution } from '@/lib/group-contribution-credit';

export default async function GroupDDSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { id } = await params;
  const { reference } = await searchParams;

  if (!reference) redirect(`/groups/${id}`);

  let credited = false;
  let errorMsg = '';

  try {
    const result = await verifyAndCreditGroupContribution(reference);
    credited = result.credited || result.alreadyCompleted || false;
    if (!credited && result.status !== 'success') {
      errorMsg = 'Payment could not be verified. If money left your account, it will be credited within minutes.';
    }
  } catch (err: any) {
    errorMsg = 'Verification check failed. Your contribution will be confirmed via webhook shortly.';
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl p-8 border text-center"
        style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>

        {credited ? (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--accent-subtle)" }}>
              <svg className="w-7 h-7" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Direct Debit Active!
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Your first contribution went through and your card is now set up for automatic group contributions. You&apos;re all set — no more manual payments.
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(255,200,0,0.1)" }}>
              <svg className="w-7 h-7" style={{ color: "#f0a500" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Processing...</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              {errorMsg || 'Your payment is being confirmed. Your direct debit will activate automatically.'}
            </p>
          </>
        )}

        <Link href={`/groups/${id}`}
          className="inline-flex items-center justify-center w-full py-3 rounded-xl text-sm font-bold transition"
          style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
          Back to Group
        </Link>
      </div>
    </div>
  );
}
