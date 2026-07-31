"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Smartphone, Trash2, Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/yield";
import { createClient } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/auth/device";

interface DevicePin {
  id: string;
  device_id: string;
  device_name: string | null;
  user_agent: string | null;
  last_used_at: string | null;
  created_at: string;
  locked_at: string | null;
}

export default function SecurityPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DevicePin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Change PIN state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeResult, setChangeResult] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data, error } = await supabase
        .from("device_pins")
        .select("id, device_id, device_name, user_agent, last_used_at, created_at, locked_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDevices(data || []);
    } catch (err) {
      setError("Failed to load device information");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    setChangeResult(null);

    if (newPin !== confirmPin) {
      setChangeError("New PINs don't match");
      return;
    }
    if (newPin === currentPin) {
      setChangeError("New PIN must be different from current PIN");
      return;
    }

    setChanging(true);
    try {
      const res = await fetch("/api/auth/pin-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const body = await res.json();
      if (!res.ok) {
        setChangeError(body.error || "Failed to change PIN");
      } else {
        setChangeResult("PIN changed successfully");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      }
    } catch {
      setChangeError("Network error. Please try again.");
    } finally {
      setChanging(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm("Remove this trusted device? You'll need email and password to sign in on it next time.")) return;
    try {
      const res = await fetch("/api/auth/pin-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        fetchDevices();
      }
    } catch {
      setError("Failed to remove device");
    }
  };

  const currentDeviceId = getDeviceId();

  if (loading) {
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
        <h1 className="font-display text-2xl text-ink">Security &amp; PIN</h1>
        <p className="text-sm text-ink-soft">Manage your PIN and trusted devices</p>
      </div>

      {/* ─── Change PIN ─── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo" />
          </div>
          <div>
            <p className="font-medium text-ink">Change PIN</p>
            <p className="text-xs text-ink-soft">Update your 4-digit PIN for this device</p>
          </div>
        </div>

        <form onSubmit={handleChangePin} className="space-y-4">
          <div>
            <label className="text-[13px] text-ink-soft mb-1.5 block">Current PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-line bg-parchment text-ink text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-loam/30"
            />
          </div>
          <div>
            <label className="text-[13px] text-ink-soft mb-1.5 block">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-line bg-parchment text-ink text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-loam/30"
            />
          </div>
          <div>
            <label className="text-[13px] text-ink-soft mb-1.5 block">Confirm New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-line bg-parchment text-ink text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-loam/30"
            />
          </div>

          <AnimatePresence>
            {changeError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2.5"
              >
                {changeError}
              </motion.p>
            )}
            {changeResult && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[13px] text-loam bg-loam/5 rounded-lg px-3 py-2.5"
              >
                {changeResult}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={changing || currentPin.length < 4 || newPin.length < 4 || confirmPin.length < 4}
            className="w-full py-3 rounded-xl bg-indigo text-white text-sm font-medium disabled:opacity-50 hover:bg-indigo-deep transition"
          >
            {changing ? "Changing…" : "Change PIN"}
          </button>
        </form>

        <Link href="/forgot-pin" className="block text-center text-[13px] text-loam font-medium mt-3 hover:text-indigo transition">
          Forgot PIN?
        </Link>
      </Card>

      {/* ─── Trusted Devices ─── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-indigo" />
          </div>
          <div>
            <p className="font-medium text-ink">Trusted Devices</p>
            <p className="text-xs text-ink-soft">{devices.length} device{devices.length === 1 ? "" : "s"} registered</p>
          </div>
        </div>

        {devices.length === 0 ? (
          <p className="text-sm text-ink-soft text-center py-4">No trusted devices registered</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const isCurrent = device.device_id === currentDeviceId;
              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    isCurrent ? "border-loam/30 bg-loam/5" : "border-line bg-parchment"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {device.device_name || "Unknown device"}
                      {isCurrent && <span className="text-loam ml-2 text-xs">• This device</span>}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {device.last_used_at
                        ? `Last used: ${new Date(device.last_used_at).toLocaleDateString()}`
                        : "Never used"}
                      {device.locked_at && " · LOCKED"}
                    </p>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => handleRevokeDevice(device.device_id)}
                      className="text-clay hover:text-clay/80 transition p-2"
                      title="Remove device"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {error && (
        <p className="text-sm text-clay text-center">{error}</p>
      )}
    </div>
  );
}
