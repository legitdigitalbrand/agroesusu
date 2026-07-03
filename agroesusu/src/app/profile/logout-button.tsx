'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full py-3 border border-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/10 transition"
    >
      Sign Out
    </button>
  );
}
