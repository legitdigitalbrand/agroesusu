"use client";

import Link from "next/link";
import { LogoMark } from "@/components/yield";

interface AuthLogoProps {
  showHome?: boolean;
}

export function AuthLogo({ showHome = false }: AuthLogoProps) {
  return (
    <div className="mb-7">
      {showHome && (
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink transition mb-5 -ml-0.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Home
        </Link>
      )}
      <div className="flex items-center gap-2">
        <LogoMark size={28} variant="customer" />
        <span className="font-display font-medium text-[17px] tracking-tight text-ink">
          Agriqcap
        </span>
      </div>
    </div>
  );
}
