'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AutoSaveSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get('plan_id');
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const i = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500);
    const t = setTimeout(() => { clearInterval(i); router.push('/save'); }, 4000);
    return () => { clearInterval(i); clearTimeout(t); };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface-base)" }}>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl"
          style={{ background: "var(--accent-subtle)" }}>
          🔄
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Auto-Save is Live!
        </h1>
        <p className="text-base mb-6" style={{ color: "var(--text-secondary)" }}>
          Your card has been saved. We'll automatically charge you on schedule — no action needed.
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Redirecting to your pots{dots}
        </p>
        <Link href="/save" className="inline-block mt-6 px-6 py-3 rounded-xl font-semibold text-sm transition"
          style={{ background: "var(--qa-primary-bg)", color: "var(--qa-primary-text)" }}>
          Go to My Pots
        </Link>
      </div>
    </div>
  );
}
