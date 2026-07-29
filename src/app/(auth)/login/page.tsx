"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/yield";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (isStaff) {
        router.push("/admin/dashboard");
        router.refresh();
        return;
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!customer) {
        try {
          await fetch("/api/bootstrap", { method: "POST" });
        } catch (err) {
          console.error("[login] Bootstrap error:", err);
        }
      }

      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-indigo flex flex-col items-center justify-center px-6 py-10">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-7">
        <LogoMark size={28} variant="admin" />
        <span className="font-display font-medium text-[17px] tracking-wide text-white/90">
          Agriqcap
        </span>
      </div>

      {/* Mini card-stack illustration */}
      <div className="relative h-[80px] w-full max-w-[200px] mb-5">
        <div
          className="absolute top-1/2 left-1/2 w-[90px] h-[58px] rounded-xl bg-indigo-deep"
          style={{ transform: "translate(-70%, -45%) rotate(-12deg)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-[90px] h-[58px] rounded-xl bg-loam shadow-xl"
          style={{ transform: "translate(-50%, -55%) rotate(-2deg)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-[90px] h-[58px] rounded-xl bg-ochre"
          style={{ transform: "translate(-30%, -42%) rotate(10deg)" }}
        >
          <div className="absolute top-2 left-2 w-[20px] h-[13px] rounded bg-ink/20" />
        </div>
        {/* Coin */}
        <div className="absolute top-0 left-3 h-[26px] w-[26px] rounded-full bg-ochre flex items-center justify-center font-mono text-[11px] font-medium text-ink shadow-md">
          ₦
        </div>
        <div className="absolute bottom-0 right-3 h-[26px] w-[26px] rounded-full bg-paper flex items-center justify-center font-mono text-[11px] font-medium text-ink shadow-md">
          ₦
        </div>
      </div>

      {/* Headline */}
      <div className="text-center mb-6">
        <h1 className="font-display font-bold text-[26px] leading-tight text-white mb-2">
          Welcome back
        </h1>
        <p className="text-[13px] text-white/70 max-w-[260px] mx-auto">
          Sign in to continue growing your savings
        </p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-[340px] bg-paper rounded-[20px] p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ys-label block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="ys-input"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="ys-label block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="ys-input pr-10"
                placeholder="••••••••"
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

          {error && (
            <p className="text-[13px] text-clay bg-clay/5 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ochre text-ink font-medium text-[15px] py-3.5 rounded-[14px] hover:bg-ochre-light transition disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-right">
          <Link href="/forgot-password" className="text-[13px] text-ink-soft hover:text-indigo transition">
            Forgot password?
          </Link>
        </div>
      </div>

      {/* Sign up link */}
      <p className="text-[14px] text-white/70 mt-6 text-center">
        New to Agriqcap?{" "}
        <Link href="/signup" className="text-ochre font-medium hover:underline">
          Create an account
        </Link>
      </p>

      {/* Fineprint */}
      <p className="text-[12px] text-white/40 text-center mt-5 max-w-[240px] leading-relaxed">
        By signing in, you agree to our{" "}
        <Link href="/terms" className="text-white/60 underline">Terms</Link>
        {" "}&{" "}
        <Link href="/privacy" className="text-white/60 underline">Privacy Policy</Link>
      </p>
    </div>
  );
}
