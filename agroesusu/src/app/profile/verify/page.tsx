import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VerifyBVNForm from './verify-bvn-form';

export default async function VerifyIdentityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, kyc_status, bvn_last_4')
    .eq('id', user.id)
    .single();

  return (
    <div className="p-4 lg:p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Verify Your Identity</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Verify your Bank Verification Number (BVN) to unlock withdrawals and higher savings limits.
      </p>

      <VerifyBVNForm
        userId={user.id}
        currentStatus={profile?.kyc_status || 'unverified'}
        bvnLast4={profile?.bvn_last_4 || null}
        fullName={profile?.full_name || ''}
      />
    </div>
  );
}
