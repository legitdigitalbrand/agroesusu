"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardTitle,
  CardDescription,
  ScreenHeader,
  StatusBadge,
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yield";
import {
  User,
  Shield,
  ShieldCheck,
  Smartphone,
  Bell,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface SettingsRowProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBgClass?: string;
  iconColorClass?: string;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
  isDestructive?: boolean;
}

function SettingsRow({
  icon: Icon,
  iconBgClass = "bg-parchment",
  iconColorClass = "text-indigo",
  title,
  description,
  href,
  onClick,
  badge,
  isDestructive = false,
}: SettingsRowProps) {
  const content = (
    <div
      className={`group flex items-center justify-between p-4 sm:p-5 transition-colors cursor-pointer hover:bg-parchment/50 ${
        isDestructive ? "hover:bg-clay-light/30" : ""
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0 pr-2">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgClass}`}
        >
          <Icon className={`h-5 w-5 ${iconColorClass}`} />
        </div>
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold leading-snug truncate ${
              isDestructive ? "text-clay" : "text-ink"
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-ink-soft leading-normal mt-0.5 truncate">
            {description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {badge}
        <ChevronRight
          className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
            isDestructive ? "text-clay opacity-70" : "text-ink-soft opacity-60"
          }`}
        />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}

export default function SettingsPage() {
  const { data: me, isLoading } = useMe();
  const profile = me?.profile;
  const [closeAccountOpen, setCloseAccountOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      // Fallback redirect
      window.location.href = "/login";
    }
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Settings"
        subtitle="Manage your personal preferences, security, and identity verification"
      />

      {/* User Profile Overview Card */}
      {isLoading ? (
        <Card padding="md" className="border-line/80">
          <div className="flex items-center gap-4">
            <Skeleton variant="circular" className="w-14 h-14" />
            <div className="space-y-2 flex-1">
              <Skeleton variant="text" className="w-48 h-5" />
              <Skeleton variant="text" className="w-32 h-4" />
            </div>
          </div>
        </Card>
      ) : (
        <Card padding="md" className="bg-paper border-line/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-parchment border border-line flex items-center justify-center text-indigo font-display font-bold text-lg shrink-0">
                {getInitials(profile?.full_name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-lg font-semibold text-ink truncate">
                    {profile?.full_name || "Account Owner"}
                  </h2>
                  <StatusBadge
                    status={profile?.kyc_status || "active"}
                    size="sm"
                  >
                    Tier {profile?.kyc_level ?? 1}
                  </StatusBadge>
                </div>
                <p className="text-xs text-ink-soft truncate mt-0.5">
                  {profile?.email || profile?.phone || "No contact info registered"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/profile">
                <Button variant="outline" size="sm" rightIcon={<ChevronRight className="h-3.5 w-3.5" />}>
                  Manage Profile
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ─── 1. Account & Verification Section ─── */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-line/60">
          <CardTitle className="text-base">Account &amp; Verification</CardTitle>
          <CardDescription>
            Manage your personal details, verification tier, and identity documents
          </CardDescription>
        </div>
        <div className="divide-y divide-line/60">
          <SettingsRow
            icon={User}
            iconBgClass="bg-parchment"
            iconColorClass="text-indigo"
            title="Profile Information"
            description="Manage your personal information and verification details"
            href="/profile"
          />
          <SettingsRow
            icon={ShieldCheck}
            iconBgClass="bg-loam-light"
            iconColorClass="text-loam"
            title="KYC &amp; Identity Verification"
            description="View verification level, BVN, NIN, and identity document status"
            href="/profile"
            badge={
              profile ? (
                <StatusBadge status={profile.kyc_status || "active"} size="sm">
                  Tier {profile.kyc_level ?? 1}
                </StatusBadge>
              ) : null
            }
          />
        </div>
      </Card>

      {/* ─── 2. Security & Devices Section ─── */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-line/60">
          <CardTitle className="text-base">Security &amp; Access</CardTitle>
          <CardDescription>
            Change PIN, manage trusted devices, and secure active sessions
          </CardDescription>
        </div>
        <div className="divide-y divide-line/60">
          <SettingsRow
            icon={Shield}
            iconBgClass="bg-indigo/10"
            iconColorClass="text-indigo"
            title="Security &amp; PIN"
            description="Change PIN, manage trusted devices, and update password settings"
            href="/settings/security"
          />
          <SettingsRow
            icon={Smartphone}
            iconBgClass="bg-ochre-light"
            iconColorClass="text-indigo-deep"
            title="Sessions &amp; Active Devices"
            description="Manage active logins and trusted devices linked to your account"
            href="/settings/security"
          />
        </div>
      </Card>

      {/* ─── 3. Preferences & Reports Section ─── */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-line/60">
          <CardTitle className="text-base">Preferences &amp; Activity</CardTitle>
          <CardDescription>
            View activity alerts, account statements, and support options
          </CardDescription>
        </div>
        <div className="divide-y divide-line/60">
          <SettingsRow
            icon={Bell}
            iconBgClass="bg-loam-light"
            iconColorClass="text-loam"
            title="Notifications &amp; Activity"
            description="View your recent account activity, transaction alerts, and updates"
            href="/notifications"
          />
          <SettingsRow
            icon={FileText}
            iconBgClass="bg-parchment"
            iconColorClass="text-indigo"
            title="Account Statements"
            description="Download official account statements, ledger summaries, and reports"
            href="/statements"
          />
          <SettingsRow
            icon={HelpCircle}
            iconBgClass="bg-ochre-light"
            iconColorClass="text-indigo-deep"
            title="Help &amp; Support"
            description="Access FAQs, support resources, or contact our customer team"
            href="/help"
          />
        </div>
      </Card>

      {/* ─── 4. Legal & Policy Section ─── */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-line/60">
          <CardTitle className="text-base">Legal &amp; Compliance</CardTitle>
          <CardDescription>
            Review terms of service, membership terms, and privacy policy
          </CardDescription>
        </div>
        <div className="divide-y divide-line/60">
          <SettingsRow
            icon={FileText}
            iconBgClass="bg-parchment"
            iconColorClass="text-ink-soft"
            title="Terms of Service"
            description="Agriqcap cooperative rules, terms of usage, and member agreements"
            href="/terms"
          />
          <SettingsRow
            icon={Lock}
            iconBgClass="bg-parchment"
            iconColorClass="text-ink-soft"
            title="Privacy Policy"
            description="Learn how we handle, store, and safeguard your personal financial data"
            href="/privacy"
          />
        </div>
      </Card>

      {/* ─── 5. Danger Zone & Session Termination ─── */}
      <Card padding="none" className="overflow-hidden border-clay/30 bg-paper">
        <div className="px-5 pt-5 pb-3 border-b border-clay/20 bg-clay-light/20">
          <CardTitle className="text-base text-clay">Account Actions &amp; Danger Zone</CardTitle>
          <CardDescription className="text-ink-soft">
            Session controls, account termination, or personal data deletion requests
          </CardDescription>
        </div>
        <div className="divide-y divide-line/60">
          <SettingsRow
            icon={LogOut}
            iconBgClass="bg-clay-light"
            iconColorClass="text-clay"
            title="Sign Out"
            description="Safely end your active session on this device"
            onClick={handleSignOut}
            isDestructive
          />
          <SettingsRow
            icon={AlertTriangle}
            iconBgClass="bg-clay-light"
            iconColorClass="text-clay"
            title="Close Account &amp; Delete Data"
            description="Request account closure or complete personal data deletion"
            onClick={() => setCloseAccountOpen(true)}
            isDestructive
          />
        </div>
      </Card>

      {/* Close Account Confirmation Dialog */}
      <Dialog open={closeAccountOpen} onOpenChange={setCloseAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-clay-light text-clay flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle>Close Account &amp; Data Request</DialogTitle>
            <DialogDescription>
              To protect member assets and maintain regulatory compliance, account closure requests require all pending loan balances, active savings plans, and wallet funds to be settled first.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-parchment border border-line rounded-2xl p-4 space-y-2 text-xs text-ink-soft my-2">
            <p className="font-semibold text-ink">Before closing your account:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Withdraw any remaining wallet balance to your bank account.</li>
              <li>Ensure all active loan obligations are fully liquidated.</li>
              <li>Download your official account statements for tax records.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCloseAccountOpen(false)}>
              Cancel
            </Button>
            <Link href="/help" className="w-full sm:w-auto">
              <Button variant="clay" fullWidth rightIcon={<ExternalLink className="h-4 w-4" />}>
                Contact Support
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
