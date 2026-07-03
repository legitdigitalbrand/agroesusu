import { Shield, Bell, ChevronRight, LogOut, BadgeCheck } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <h1 className="text-xl font-semibold text-stone-900 mb-6">Profile</h1>

      {/* User Card */}
      <div className="bg-white border border-brand-border rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-green flex items-center justify-center">
            <span className="text-white font-semibold text-lg">CO</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-stone-900">Chinedu Okonkwo</h2>
              <BadgeCheck className="w-4 h-4 text-brand-lime-dark" />
            </div>
            <p className="text-xs text-stone-400 mt-0.5">+234 803 ••• 4521</p>
            <p className="text-xs text-stone-400">Member since July 2026</p>
          </div>
        </div>

        {/* Credit Score */}
        <div className="mt-4 pt-4 border-t border-brand-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Credit Score</span>
            <span className="text-xs font-medium text-brand-lime-dark">Building</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-stone-900 tabular-nums">320</span>
            <span className="text-xs text-stone-400">/ 850</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-brand-lime rounded-full" style={{ width: "38%" }} />
          </div>
          <p className="text-xs text-stone-400 mt-2">Save consistently to improve your score and unlock loans</p>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white border border-brand-border rounded-2xl divide-y divide-brand-border">
        <button className="w-full flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors text-left">
          <Shield className="w-5 h-5 text-stone-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">BVN Verification</p>
            <p className="text-xs text-stone-400 mt-0.5">Pending — verify to unlock all features</p>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-300" />
        </button>

        <button className="w-full flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors text-left">
          <Bell className="w-5 h-5 text-stone-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">Notifications</p>
            <p className="text-xs text-stone-400 mt-0.5">In-app alerts enabled</p>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-300" />
        </button>

        <button className="w-full flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors text-left">
          <div className="w-5 h-5 flex items-center justify-center">
            <span className="text-stone-400 text-sm">⚙</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">App Settings</p>
            <p className="text-xs text-stone-400 mt-0.5">Language, theme, about</p>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-300" />
        </button>
      </div>

      {/* Logout */}
      <button className="w-full flex items-center justify-center gap-2 mt-6 text-sm font-medium text-red-500 py-3.5 rounded-xl border border-red-100 hover:bg-red-50 transition-colors">
        <LogOut className="w-4 h-4" />
        Log Out
      </button>

      <p className="text-xs text-stone-300 text-center mt-6">AgroEsusu v1.0.0 — Save. Grow. Thrive.</p>
    </div>
  );
}
