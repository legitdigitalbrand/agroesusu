"use client";

import { useMe } from "@/hooks/use-me";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  StatusBadge,
  ProgressRing,
  ErrorState,
  LoadingState,
  ScreenHeader,
} from "@/components/yield";
import {
  User,
  LogOut,
  MapPin,
  Lock,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const kycLevelLabels: Record<number, string> = {
  0: "Unverified",
  1: "Basic Verification",
  2: "Standard (BVN + ID)",
  3: "Enhanced Verification",
};

function maskNumber(val?: string | null): string {
  if (!val || val.trim() === "") return "Not provided";
  const cleaned = val.trim();
  if (cleaned.length <= 4) return cleaned;
  return `****${cleaned.slice(-4)}`;
}

export default function ProfilePage() {
  const { data: me, isLoading, error, refetch } = useMe();
  const router = useRouter();

  if (isLoading) return <LoadingState message="Loading profile…" />;
  if (error || !me) return <ErrorState message="Couldn't load profile" onRetry={() => refetch()} />;

  const profile = me.profile;
  const kycLevel = profile.kyc_level ?? 0;
  const kycProgress = Math.min(100, Math.round((kycLevel / 3) * 100));

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <ScreenHeader
        title="Profile & Account"
        subtitle="Manage your personal details, verification, and security settings"
      />

      {/* 1. Profile Header Card */}
      <Card variant="dark" className="relative overflow-hidden text-center p-6 sm:p-8">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-paper/10 border-2 border-ochre/50 flex items-center justify-center shadow-md backdrop-blur-xs">
            <span className="font-display text-2xl sm:text-3xl font-bold text-white tracking-wider">
              {initials(profile.full_name || "User")}
            </span>
          </div>

          <h2 className="mt-4 font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
            {profile.full_name || "Valued User"}
          </h2>
          <p className="text-sm text-parchment/80 font-medium mt-1">
            {profile.email || "Not provided"}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <StatusBadge status={profile.kyc_status || "pending"} />
            <span className="text-xs text-parchment/80 font-medium bg-indigo-deep/60 px-3 py-1 rounded-full border border-indigo-light/20">
              Member since {formatDate(profile.created_at)}
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Personal Information */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2.5 pb-2 border-b border-line/60">
          <div className="p-2 rounded-lg bg-indigo/10 text-indigo">
            <User className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your registered account and identity details</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InfoField label="Full Name" value={profile.full_name} />
            <InfoField label="Email Address" value={profile.email} />
            <InfoField label="Phone Number" value={profile.phone} />
            <InfoField label="BVN" value={maskNumber(profile.bvn)} />
            <InfoField label="NIN" value={maskNumber(profile.nin)} />
            <InfoField label="Occupation" value={profile.occupation} />
            <InfoField label="Farm Type" value={profile.farm_type} />
            <InfoField label="Primary Produce" value={profile.primary_produce} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Address Section */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2.5 pb-2 border-b border-line/60">
          <div className="p-2 rounded-lg bg-indigo/10 text-indigo">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Address Details</CardTitle>
            <CardDescription>Your verified residential and local location</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InfoField label="Residential Address" value={profile.residential_address} fullWidth />
            <InfoField label="State" value={profile.state} />
            <InfoField label="LGA" value={profile.lga} />
          </div>
        </CardContent>
      </Card>

      {/* 4. Next of Kin Section */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2.5 pb-2 border-b border-line/60">
          <div className="p-2 rounded-lg bg-indigo/10 text-indigo">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Next of Kin</CardTitle>
            <CardDescription>Emergency contact information linked to your profile</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InfoField label="NOK Name" value={profile.nok_name} />
            <InfoField label="NOK Phone" value={profile.nok_phone} />
            <InfoField label="NOK Relationship" value={profile.nok_relationship} fullWidth />
          </div>
        </CardContent>
      </Card>

      {/* 5. Verification Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-line/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo/10 text-indigo">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>KYC Verification</CardTitle>
              <CardDescription>Identity verification level and compliance</CardDescription>
            </div>
          </div>
          <StatusBadge status={profile.kyc_status || "pending"} />
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-parchment/40 border border-line/60">
            <ProgressRing
              progress={kycProgress}
              size={100}
              strokeWidth={8}
              label={`${kycProgress}%`}
              sublabel={`Level ${kycLevel}`}
              variant="indigo"
            />
            <div className="space-y-1.5 text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-2">
                <span className="font-display font-semibold text-ink text-base">
                  {kycLevelLabels[kycLevel] || `Level ${kycLevel}`}
                </span>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                {kycLevel >= 3
                  ? "Your account is fully verified. You have unlocked all transaction limits and premium features."
                  : "Complete your identity verification to increase transfer limits and access loans and investments."}
              </p>
            </div>
          </div>

          {/* Steps breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KycStepItem
              step={1}
              title="Basic Profile"
              description="Phone & Personal details"
              isDone={kycLevel >= 1}
            />
            <KycStepItem
              step={2}
              title="Identity & BVN"
              description="BVN & Government ID"
              isDone={kycLevel >= 2}
            />
            <KycStepItem
              step={3}
              title="Enhanced Verification"
              description="Proof of Address & Limits"
              isDone={kycLevel >= 3}
            />
          </div>

          {kycLevel < 3 && (
            <Button
              variant="loam"
              fullWidth
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => router.push("/onboarding")}
            >
              Complete Verification
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 6. Security Shortcuts */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2.5 pb-2 border-b border-line/60">
          <div className="p-2 rounded-lg bg-indigo/10 text-indigo">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Security Shortcuts</CardTitle>
            <CardDescription>Quick actions to secure your account</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <SecurityShortcutItem
            icon={KeyRound}
            title="Change PIN"
            subtitle="Update your 4-digit security PIN for transfers and authorizations"
            onClick={() => router.push("/settings/security")}
          />
          <SecurityShortcutItem
            icon={Smartphone}
            title="Manage Devices"
            subtitle="View active sessions and manage trusted devices"
            onClick={() => router.push("/settings/security")}
          />
        </CardContent>
      </Card>

      {/* 7. Logout Button */}
      <div className="pt-2">
        <Button
          variant="clay"
          size="lg"
          fullWidth
          leftIcon={<LogOut className="h-5 w-5" />}
          onClick={handleLogout}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}) {
  const isProvided = Boolean(value && value.trim() !== "" && value !== "Not provided");
  const displayValue = isProvided ? value! : "Not provided";

  return (
    <div className={cn("bg-parchment/40 p-3.5 rounded-xl border border-line/60 flex flex-col justify-center", fullWidth && "sm:col-span-2")}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft mb-1 block">
        {label}
      </span>
      <span className={cn("text-sm font-semibold break-words block", isProvided ? "text-ink" : "text-ink-soft/60 italic font-normal")}>
        {displayValue}
      </span>
    </div>
  );
}

function KycStepItem({
  step,
  title,
  description,
  isDone,
}: {
  step: number;
  title: string;
  description: string;
  isDone: boolean;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-xl border flex items-start gap-3 transition-colors",
        isDone
          ? "bg-loam-light/40 border-loam/30 text-ink"
          : "bg-parchment/20 border-line/60 text-ink-soft"
      )}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
          isDone ? "bg-loam text-white" : "bg-track/60 text-ink-soft"
        )}
      >
        {isDone ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <div>
        <h5 className="text-xs font-semibold text-ink">{title}</h5>
        <p className="text-[11px] text-ink-soft mt-0.5 leading-tight">{description}</p>
      </div>
    </div>
  );
}

function SecurityShortcutItem({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="w-full flex items-center justify-between p-3.5 rounded-xl bg-paper border border-line/80 hover:bg-parchment/60 hover:border-line transition duration-150 text-left group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-indigo/10 text-indigo group-hover:bg-indigo group-hover:text-white transition duration-150 shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink group-hover:text-indigo transition duration-150">{title}</h4>
          <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-soft group-hover:text-indigo group-hover:translate-x-0.5 transition duration-150 shrink-0" />
    </button>
  );
}
