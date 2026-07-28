import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppShell from "@/components/app/app-shell";

export const revalidate = 0;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  // Get active session user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Fetch wallet
  let wallet = null;
  const { data: walletData } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!walletData) {
    // Attempt auto-creation of wallet if missing
    const { data: newWallet } = await supabase
      .from("wallets")
      .insert({ user_id: user.id, balance: 0 })
      .select()
      .maybeSingle();
    wallet = newWallet;
  } else {
    wallet = walletData;
  }

  // Fetch unread notifications count
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return (
    <AppShell
      profile={profile}
      wallet={wallet}
      unreadNotificationsCount={unreadCount || 0}
    >
      {children}
    </AppShell>
  );
}
