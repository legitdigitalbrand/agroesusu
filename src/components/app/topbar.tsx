import { Bell } from 'lucide-react';
import Link from 'next/link';

export default function AppTopbar({
  name,
  avatarUrl,
  unreadNotifications,
}: {
  name: string;
  avatarUrl: string | null;
  unreadNotifications: number;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="h-16 border-b bg-white px-4 lg:px-8 flex items-center justify-between pl-14 lg:pl-8">
      <h2 className="text-lg font-semibold text-forest-green">
        {greeting}, {name}
      </h2>
      <div className="flex items-center gap-4">
        <Link href="/notifications" className="relative p-2 rounded-full hover:bg-cream">
          <Bell size={20} className="text-forest-green" />
          {unreadNotifications > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-rust-orange text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadNotifications}
            </span>
          )}
        </Link>
        <Link href="/profile" className="w-9 h-9 rounded-full bg-forest-green text-white flex items-center justify-center text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
