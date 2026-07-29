"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/yield";

export default function VerifyPhonePage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);

  const handleDigitChange = (i: number, val: string) => {
    if (val.length > 1) return;
    const newCode = [...code];
    newCode[i] = val;
    setCode(newCode);
    if (val && i < 5) {
      const next = document.getElementById(`digit-${i + 1}`);
      next?.focus();
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Wire to OTP verification
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-indigo-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center mb-8">
          <span className="font-serif text-3xl text-white">Agriqcap</span>
        </Link>

        <div className="bg-paper rounded-2xl shadow-xl p-8">
          <h1 className="font-serif text-2xl text-ink mb-1">Verify your phone</h1>
          <p className="text-sm text-ink-soft mb-6">
            Enter the 6-digit code sent to your phone.
          </p>

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex justify-between gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  id={`digit-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  className="w-12 h-14 text-center text-xl font-mono rounded-lg border border-track bg-paper text-ink focus:border-indigo focus:outline-none"
                />
              ))}
            </div>
            <Button type="submit" className="w-full">Verify</Button>
          </form>

          <p className="text-center mt-4 text-sm text-ink-soft">
            Didn't get a code?{" "}
            <button className="text-indigo font-medium hover:underline">Resend</button>
          </p>
        </div>
      </div>
    </div>
  );
}
