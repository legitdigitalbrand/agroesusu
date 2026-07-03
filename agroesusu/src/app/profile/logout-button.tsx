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
      className="w-full py-3 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition"
    >
      Sign Out
    </button>
  );
}
