"use client";

import React, { useState } from "react";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import { Profile, Wallet } from "@/lib/types";

interface AppShellProps {
  profile: Profile;
  wallet: Wallet | null;
  unreadNotificationsCount: number;
  children: React.ReactNode;
}

export default function AppShell({
  profile,
  unreadNotificationsCount,
  children,
}: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-parchment/50">
      {/* Sidebar Navigation */}
      <Sidebar
        profile={profile}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Panel */}
      <div className="flex flex-col md:pl-72 min-h-screen">
        {/* Topbar */}
        <Topbar
          profile={profile}
          unreadNotificationsCount={unreadNotificationsCount}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Dynamic Content */}
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
