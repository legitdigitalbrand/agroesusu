"use client";

import { LogoMark } from "@/components/yield";

export function AuthLogo() {
  return (
    <div className="flex items-center gap-2.5 mb-7">
      <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-indigo to-indigo-deep flex items-center justify-center">
        <LogoMark size={20} variant="admin" />
      </div>
      <span className="font-display font-bold text-[18px] tracking-tight text-ink">
        Agriqcap
      </span>
    </div>
  );
}
