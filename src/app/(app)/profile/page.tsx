"use client";

import { useMe } from "@/hooks/use-me";
import {
  Card, ScreenHeader, LoadingState, ErrorState, StatusBadge, Button,
} from "@/components/yield";
import { User, Shield, LogOut, Phone, Mail, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

export default function ProfilePage() {
  const { data: me, isLoading, error, refetch } = useMe();
  const router = useRouter();

  if (isLoading) return <LoadingState message="Loading profile…" />;
  if (error || !me) return <ErrorState message="Couldn't load profile" onRetry={() => refetch()} />;

  const profile = me.profile;
  const kycLevelLabel: Record<number, string> = {
    0: "Unverified",
    1: "Basic",
    2: "Standard (BVN + ID)",
    3: "Enhanced",
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title="Profile" />

      {/* Avatar + name */}
      <Card className="text-center">
        <div className="inline-flex h-16 w-16 rounded-full bg-indigo/10 items-center justify-center mx-auto">
          <User className="h-7 w-7 text-indigo" />
        </div>
        <h2 className="mt-3 font-serif text-xl text-ink">{profile.full_name}</h2>
        <p className="text-sm text-ink-soft">{profile.email}</p>
      </Card>

      {/* KYC status */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-indigo" />
            <div>
              <p className="text-sm font-medium text-ink">KYC Verification</p>
              <p className="text-xs text-ink-soft">Level {profile.kyc_level} — {kycLevelLabel[profile.kyc_level]}</p>
            </div>
          </div>
          <StatusBadge status={profile.kyc_status || "pending"} />
        </div>
        {profile.kyc_level < 2 && (
          <div className="mt-4">
            <Button size="sm" variant="loam" className="w-full">Verify your identity</Button>
          </div>
        )}
      </Card>

      {/* Personal info */}
      <Card>
        <h3 className="font-serif text-base text-ink mb-3">Personal Information</h3>
        <div className="space-y-3">
          <InfoRow icon={Phone} label="Phone" value={profile.phone} />
          <InfoRow icon={Mail} label="Email" value={profile.email || "—"} />
          {profile.state && (
            <InfoRow icon={MapPin} label="Location" value={`${profile.lga || ""}, ${profile.state}`} />
          )}
          {profile.occupation && (
            <InfoRow icon={User} label="Occupation" value={profile.occupation} />
          )}
        </div>
      </Card>

      {/* Next of kin */}
      {profile.nok_name && (
        <Card>
          <h3 className="font-serif text-base text-ink mb-3">Next of Kin</h3>
          <div className="space-y-3">
            <InfoRow icon={User} label="Name" value={profile.nok_name} />
            {profile.nok_phone && <InfoRow icon={Phone} label="Phone" value={profile.nok_phone} />}
            {profile.nok_relationship && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Relationship</span>
                <span className="text-ink capitalize">{profile.nok_relationship}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Member since */}
      <p className="text-center text-xs text-ink-soft">
        Member since {formatDate(profile.created_at)}
      </p>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-clay hover:bg-clay/5 rounded-lg transition"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-ink-soft" />
        <span className="text-sm text-ink-soft">{label}</span>
      </div>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}
