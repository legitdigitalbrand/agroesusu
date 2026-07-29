"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/yield";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    // TODO: Wire to Supabase auth updateUser
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-indigo-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="flex items-center justify-center mb-8">
          <span className="font-display text-3xl text-white">Agriqcap</span>
        </Link>

        <div className="bg-paper rounded-2xl shadow-xl p-8">
          <h1 className="font-display text-2xl text-ink mb-1">Set new password</h1>
          <p className="text-sm text-ink-soft mb-6">Choose a new password for your account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="ys-label">NEW PASSWORD</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-track bg-paper px-4 py-3 text-ink focus:border-indigo focus:outline-none"
              />
            </div>
            <div>
              <label className="ys-label">CONFIRM PASSWORD</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-track bg-paper px-4 py-3 text-ink focus:border-indigo focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-clay">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Reset password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
