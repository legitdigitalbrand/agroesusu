"use client";

import { useRouter } from "next/navigation";
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
  BackLink,
} from "@/components/yield";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { useMe } from "@/hooks/use-me";

const kycLevelLabels: Record<number, string> = {
  0: "Unverified",
  1: "Basic Verification",
  2: "Standard (BVN + ID)",
  3: "Enhanced Verification",
};

function maskNumber(val?: string | null): string {
  if (!val || val.trim() === "") return "—";
  const cleaned = val.trim();
  if (cleaned.length <= 4) return cleaned;
  return `****${cleaned.slice(-4)}`;
}

/**
 * Compliance & Verification — the dedicated home for everything KYC:
 * BVN/NIN verification, level progress and next steps. Split out of the
 * Profile page so customers don't have to scroll past personal details
 * to find identity verification.
 */
export default function CompliancePage() {
  const { data: me, isLoading, error, refetch } = useMe();
  const router = useRouter();

  if (isLoading) return <LoadingState message="Loading compliance status…" />;
  if (error || !me) return <ErrorState message="Couldn't load compliance status" onRetry={() => refetch()} />;

  const profile = me.profile;
  const kycLevel = profile.kyc_level ?? 0;
  const kycProgress = Math.min(100, Math.round((kycLevel / 3) * 100));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <ScreenHeader
        title="Compliance & Verification"
        backButton={<BackLink href="/dashboard" />}
        subtitle="Verify your identity to unlock your funding account, deposits, loans and higher limits"
      />

      {/* Status hero */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-line/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo/10 text-indigo">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>KYC Status</CardTitle>
              <CardDescription>Identity verification level and compliance</CardDescription>
            </div>
          </div>
          <StatusBadge status={profile.kyc_status || "unverified"} />
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

          {/* Identity Verification (BVN / NIN) — Safe Haven OTP flow */}
          <div className="p-4 rounded-xl border border-line/60 bg-paper">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo" />
                  <span className="text-sm font-semibold text-ink">Identity Verification (BVN / NIN)</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
                  <span>BVN: <span className="font-mono">{profile.bvn ? maskNumber(profile.bvn) : "—"}</span></span>
                  <span>NIN: <span className="font-mono">{profile.nin ? maskNumber(profile.nin) : "—"}</span></span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  {kycLevel >= 1
                    ? "Your identity is verified with our banking partner. You can re-run verification at any time to use a different BVN or NIN."
                    : "Verify your BVN or NIN to unlock deposits and your funding account. A one-time password (OTP) will be sent to the phone number registered with it."}
                </p>
              </div>
              <Button
                variant={kycLevel >= 1 ? "secondary" : "primary"}
                size="sm"
                leftIcon={<ShieldCheck className="h-4 w-4" />}
                onClick={() => router.push("/verify")}
              >
                {kycLevel >= 1 ? "Update BVN / NIN" : "Verify BVN / NIN"}
              </Button>
            </div>
          </div>

          {/* Steps breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KycStepItem step={1} title="Basic Profile" description="Phone & personal details" isDone={kycLevel >= 1} />
            <KycStepItem step={2} title="Identity & BVN" description="BVN & government ID" isDone={kycLevel >= 2} />
            <KycStepItem step={3} title="Enhanced Verification" description="Proof of address & limits" isDone={kycLevel >= 3} />
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
    <div className={`p-3.5 rounded-xl border ${isDone ? "border-loam/40 bg-loam-light/30" : "border-line/60 bg-parchment/30"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${isDone ? "bg-loam text-white" : "bg-line text-ink-soft"}`}>
          {isDone ? <CheckCircle2 className="h-4 w-4" /> : step}
        </span>
        <span className="text-[13px] font-semibold text-ink">{title}</span>
      </div>
      <p className="text-[11.5px] text-ink-soft leading-snug pl-8">{description}</p>
    </div>
  );
}
