import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LogoutButton from './logout-button';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: accounts } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', user.id);

  const { count: groupCount } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-green mb-6">Profile</h1>

      {/* Profile Card */}
      <div className="bg-white border border-brand-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center">
            <span className="text-brand-green font-bold text-xl">
              {(profile?.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-800">{profile?.full_name || 'User'}</h2>
            <p className="text-sm text-stone-500">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-brand-lime/20 text-brand-green font-medium capitalize">
              {profile?.tier || 'basic'} tier
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-stone-500">Phone</p>
            <p className="text-sm font-medium text-stone-800">{profile?.phone || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">KYC Status</p>
            <p className="text-sm font-medium text-stone-800 capitalize">{profile?.kyc_status || 'pending'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Credit Score</p>
            <p className="text-sm font-medium text-stone-800">{profile?.credit_score || 300}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Account Status</p>
            <p className="text-sm font-medium text-green-600 capitalize">{profile?.account_status || 'active'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-brand-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-brand-green">{accounts?.length || 0}</p>
          <p className="text-xs text-stone-500 mt-1">Savings Pots</p>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-brand-green">{groupCount || 0}</p>
          <p className="text-xs text-stone-500 mt-1">Groups</p>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-brand-green">₦{Number(profile?.total_saved || 0).toLocaleString()}</p>
          <p className="text-xs text-stone-500 mt-1">Total Saved</p>
        </div>
      </div>

      {/* Logout */}
      <LogoutButton />
    </div>
  );
}
