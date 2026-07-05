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
      className="w-full py-3 border rounded-lg font-medium transition"
      style={{ borderColor: "rgba(255,77,109,0.2)", color: "var(--danger)" }}
    >
      Sign Out
    </button>
  );
}
