"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, ChevronLeft, Loader2 } from "lucide-react";
import { Card, Button } from "@/components/yield";
import { useMe } from "@/hooks/use-me";

export default function SecurityPage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-loam" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition">
        <ChevronLeft className="h-4 w-4" />
        Settings
      </Link>

      <div>
        <h1 className="font-display text-2xl text-ink">Security</h1>
        <p className="text-sm text-ink-soft">Manage your account security</p>
      </div>

      {/* ─── Password ─── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-indigo" />
          </div>
          <div>
            <p className="font-medium text-ink">Password</p>
            <p className="text-xs text-ink-soft">Change your account password</p>
          </div>
        </div>
        <Link href="/reset-password">
          <Button variant="outline" className="w-full">
            Change Password
          </Button>
        </Link>
      </Card>

      {/* ─── Account Status ─── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo" />
          </div>
          <div>
            <p className="font-medium text-ink">Account Status</p>
            <p className="text-xs text-ink-soft">Your account verification level</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-sm text-ink-soft">Email</span>
            <span className="text-sm text-ink font-medium">{me?.profile?.email || "—"}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-sm text-ink-soft">KYC Level</span>
            <span className="text-sm text-ink font-medium">
              {me?.profile?.kyc_level ? `Tier ${me.profile.kyc_level}` : "Unverified"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-ink-soft">Verification Status</span>
            <span className="text-sm text-ink font-medium">
              {me?.profile?.kyc_status === "verified" ? "✓ Verified" : "Pending"}
            </span>
          </div>
        </div>
      </Card>

      {/* ─── Session Info ─── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo" />
          </div>
          <div>
            <p className="font-medium text-ink">Session</p>
            <p className="text-xs text-ink-soft">Your session remains active for 24 hours after login</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full text-clay border-clay/20"
          onClick={async () => {
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/login");
          }}
        >
          Sign Out
        </Button>
      </Card>
    </div>
  );
}
