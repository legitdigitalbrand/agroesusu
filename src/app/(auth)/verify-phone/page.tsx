"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/yield";

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
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-indigo flex flex-col items-center justify-center px-5 py-10">
      <div className="flex items-center gap-2 mb-6">
        <LogoMark size={28} variant="admin" />
        <span className="font-display font-medium text-[17px] tracking-wide text-white/90">
          Agriqcap
        </span>
      </div>

      <div className="text-center mb-5">
        <h1 className="font-display font-bold text-[24px] sm:text-[26px] leading-tight text-white mb-2">
          Verify your phone
        </h1>
        <p className="text-[13px] text-white/70 max-w-[280px] mx-auto">
          Enter the 6-digit code sent to your phone
        </p>
      </div>

      <div className="w-full max-w-[340px]">
        <form onSubmit={handleVerify} className="space-y-6">
          {/* OTP inputs — responsive: smaller gap + width on very small screens */}
          <div className="flex justify-between gap-1.5 sm:gap-2">
            {code.map((digit, i) => (
              <input
                key={i}
                id={`digit-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                className="flex-1 min-w-0 h-[48px] sm:h-[52px] text-center text-[18px] sm:text-[20px] font-mono rounded-lg border border-track bg-paper text-ink focus:border-indigo focus:outline-none transition"
              />
            ))}
          </div>
          <button
            type="submit"
            className="w-full bg-ochre text-ink font-medium text-[15px] py-3.5 rounded-[14px] hover:bg-ochre-light transition min-h-[48px]"
          >
            Verify
          </button>
        </form>

        <p className="text-center mt-4 text-[14px] text-white/70">
          Didn&apos;t get a code?{" "}
          <button className="text-ochre font-medium hover:underline min-h-[44px]">Resend</button>
        </p>
      </div>
    </div>
  );
}
