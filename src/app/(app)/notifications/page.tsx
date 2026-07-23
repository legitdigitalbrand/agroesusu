import { createClient } from '@/lib/supabase/server';
import EmptyState from '@/components/app/empty-state';
import { formatDateTime } from '@/lib/format';
import { Bell } from 'lucide-react';

export default async function NotificationsPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: notifications } = await supabase.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>

      {notifications && notifications.length > 0 ? (
        <div className="bg-white rounded-2xl border divide-y">
          {notifications.map((n) => (
            <div key={n.id} className={`p-4 ${!n.read ? 'bg-forest-green/5' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!n.read ? 'bg-forest-green/10' : 'bg-gray-50'}`}>
                  <Bell size={18} className={n.read ? 'text-gray-400' : 'text-forest-green'} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-forest-green mt-2" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-8">
          <EmptyState title="No notifications" description="You'll see loan updates, payment confirmations, and more here" />
        </div>
      )}
    </div>
  );
}
