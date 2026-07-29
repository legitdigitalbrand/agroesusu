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

    // Check if onboarding is complete
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: customer } = await supabase
        .from("customers")
        .select("kyc_level")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!customer) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-indigo-deep flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-3 justify-center">
          <LogoMark size={48} variant="admin" />
          <span className="font-serif text-3xl text-white">Yield</span>
        </div>
        <p className="mt-2 text-sm text-white/50">Save. Borrow. Grow.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-paper rounded-2xl p-6">
        <h1 className="font-serif text-2xl text-ink">Welcome back</h1>
        <p className="text-sm text-ink-soft mt-1">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            <p className="text-sm text-clay bg-clay/5 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ys-btn-primary w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-ink-soft">
            New to Yield?{" "}
            <Link href="/signup" className="text-loam font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
