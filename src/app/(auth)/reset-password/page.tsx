"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/yield";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-indigo flex flex-col items-center justify-center px-6 py-10">
      <div className="flex items-center gap-2 mb-6">
        <LogoMark size={28} variant="admin" />
        <span className="font-display font-medium text-[17px] tracking-wide text-white/90">
          Agriqcap
        </span>
      </div>

      <div className="text-center mb-5">
        <h1 className="font-display font-bold text-[26px] leading-tight text-white mb-2">
          Set new password
        </h1>
        <p className="text-[13px] text-white/70 max-w-[280px] mx-auto">
          Choose a new password for your account
        </p>
      </div>

      <div className="w-full max-w-[340px] bg-paper rounded-[20px] p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ys-label block mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="ys-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="ys-label block mb-1.5">Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="ys-input"
            />
          </div>
          {error && <p className="text-[13px] text-clay">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ochre text-ink font-medium text-[15px] py-3.5 rounded-[14px] hover:bg-ochre-light transition disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Reset password"}
          </button>
        </form>
      </div>

      <p className="text-[14px] text-white/70 mt-5 text-center">
        <Link href="/login" className="text-ochre font-medium hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
