'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    // Instant feedback before the async round-trip — otherwise the button
    // just sits there looking unresponsive until signOut()+redirect resolve.
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isSigningOut}
      className="w-full py-3 border rounded-lg font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      style={{ borderColor: "rgba(255,77,109,0.2)", color: "var(--danger)" }}
    >
      {isSigningOut ? 'Signing out…' : 'Sign Out'}
    </button>
  );
}
