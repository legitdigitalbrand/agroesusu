"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/yield";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      router.push("/onboarding");
    }
  };

  return (
    <div className="min-h-screen bg-indigo-deep flex flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-3 justify-center">
          <LogoMark size={48} variant="admin" />
          <span className="font-serif text-3xl text-white">Agriqcap</span>
        </div>
      </div>

      <div className="w-full max-w-sm bg-paper rounded-2xl p-6">
        <h1 className="font-serif text-2xl text-ink">Create your account</h1>
        <p className="text-sm text-ink-soft mt-1">Start saving and growing today</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="ys-label block mb-1.5">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={3}
              className="ys-input"
              placeholder="Adaeze Okoro"
            />
          </div>

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
            <label className="ys-label block mb-1.5">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="ys-input"
              placeholder="08123456789"
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
                minLength={6}
                className="ys-input pr-10"
                placeholder="Minimum 6 characters"
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

          <button type="submit" disabled={loading} className="ys-btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-ink-soft">
            Already have an account?{" "}
            <Link href="/login" className="text-loam font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
