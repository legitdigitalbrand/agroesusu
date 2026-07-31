"use client";

import { Card } from "@/components/yield";
import { Bell, User, Globe, LogOut, Shield, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const settings = [
    { icon: User, label: "Profile & Verification", href: "/profile", desc: "Manage your personal info and KYC" },
    { icon: Bell, label: "Notifications", href: "/notifications", desc: "View your recent account activity" },
    { icon: Shield, label: "Security & PIN", href: "/settings/security", desc: "Change PIN, manage trusted devices" },
    { icon: Globe, label: "Language & Region", href: "/settings", desc: "English (Nigeria) • GMT+1" },
    { icon: HelpCircle, label: "Help & Support", href: "/help", desc: "Get help with your account" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Settings</h1>
        <p className="text-sm text-ink-soft">Manage your account preferences</p>
      </div>

      <div className="space-y-3">
        {settings.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="flex items-center gap-4 hover:shadow-md transition cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-parchment flex items-center justify-center">
                  <Icon className="h-5 w-5 text-indigo" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink">{s.label}</p>
                  <p className="text-xs text-ink-soft">{s.desc}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <Card className="border-clay/30">
        <button
          onClick={async () => {
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-4 text-clay hover:text-clay/80 transition"
        >
          <div className="h-10 w-10 rounded-xl bg-clay/10 flex items-center justify-center">
            <LogOut className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium">Sign out</p>
            <p className="text-xs opacity-70">End your session securely</p>
          </div>
        </button>
      </Card>
    </div>
  );
}
