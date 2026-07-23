import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppSidebar from '@/components/app/sidebar';
import AppTopbar from '@/components/app/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  const { data: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('read', false);

  return (
    <div className="min-h-screen bg-cream flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col lg:ml-64">
        <AppTopbar
          name={profile?.full_name || 'Farmer'}
          avatarUrl={null}
          unreadNotifications={unreadCount || 0}
        />
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
