"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, ChevronLeft, Loader2, KeyRound } from "lucide-react";
import { Card, Button } from "@/components/yield";
import { useMe } from "@/hooks/use-me";

export default function SecurityPage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();

  // ── Login PIN state ──
  const [pinFlow, setPinFlow] = useState<"idle" | "form">("idle");
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/login-pin");
        if (res.ok) {
          const data = await res.json();
          setHasPin(!!data.has_pin);
        }
      } catch { /* leave null — card falls back gracefully */ }
    })();
  }, []);

  const handlePinSave = async () => {
    setPinSaving(true);
    setPinError(null);
    setPinSuccess(false);
    try {
      const res = await fetch("/api/auth/login-pin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPin, confirmPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPinError(data.error || "Could not save your PIN. Please try again.");
        return;
      }
      setPinSuccess(true);
      setHasPin(true);
      setCurrentPassword("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => { setPinFlow("idle"); setPinSuccess(false); }, 1500);
    } catch {
      setPinError("Something went wrong. Please try again.");
    } finally {
      setPinSaving(false);
    }
  };

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

      {/* ─── Login PIN ─── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-indigo" />
          </div>
          <div>
            <p className="font-medium text-ink">Login PIN</p>
            <p className="text-xs text-ink-soft">
              {hasPin === null
                ? "Extra security for sign-ins"
                : hasPin
                  ? "Required each time you sign in"
                  : "Add a 4-digit PIN for extra security"}
            </p>
          </div>
        </div>

        {pinFlow === "idle" ? (
          <Button
            variant={hasPin ? "outline" : "primary"}
            className="w-full"
            onClick={() => setPinFlow("form")}
          >
            {hasPin ? "Change PIN" : "Set Up PIN"}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-ink-soft">
              For your security, confirm your current password to {hasPin ? "change" : "set"} your PIN.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full h-11 rounded-xl border border-input bg-card px-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              className="w-full h-11 rounded-xl border border-input bg-card px-4 text-sm text-ink tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="New 4-digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              className="w-full h-11 rounded-xl border border-input bg-card px-4 text-sm text-ink tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            {pinError && <p className="text-sm text-clay" role="alert">{pinError}</p>}
            {pinSuccess && <p className="text-sm text-emerald-600">PIN saved ✓</p>}
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={handlePinSave}
                disabled={pinSaving || !currentPassword || newPin.length !== 4 || newPin !== confirmPin}
              >
                {pinSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save PIN"}
              </Button>
              <Button variant="outline" onClick={() => { setPinFlow("idle"); setPinError(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
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
            await fetch("/api/auth/sign-out", { method: "POST" });
            router.push("/login");
          }}
        >
          Sign Out
        </Button>
      </Card>
    </div>
  );
}
