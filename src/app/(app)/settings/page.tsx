"use client";

import { Card } from "@/components/yield";
import { Bell, Lock, User, Globe, LogOut } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const settings = [
    { icon: User, label: "Profile & Verification", href: "/profile", desc: "Manage your personal info and KYC" },
    { icon: Bell, label: "Notifications", href: "/notifications", desc: "Manage your notification preferences" },
    { icon: Lock, label: "Security", href: "/settings", desc: "Password and session management" },
    { icon: Globe, label: "Language & Region", href: "/settings", desc: "English (Nigeria) • GMT+1" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">Settings</h1>
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
            // Logout handled by Supabase client
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className="flex items-center gap-4 w-full text-left"
        >
          <div className="h-10 w-10 rounded-xl bg-clay/10 flex items-center justify-center">
            <LogOut className="h-5 w-5 text-clay" />
          </div>
          <div>
            <p className="font-medium text-clay">Log out</p>
            <p className="text-xs text-ink-soft">Sign out of your Agriqcap account</p>
          </div>
        </button>
      </Card>
    </div>
  );
}
