"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

const DISMISS_KEY = "agriqcap_welcome_dismissed";

export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-br from-indigo to-indigo-deep rounded-2xl p-5 text-white overflow-hidden">
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-ochre/10 pointer-events-none" />
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-paper/10 flex items-center justify-center hover:bg-paper/20 transition"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-ochre" />
          <h3 className="font-display font-semibold text-[16px]">Welcome to Agriqcap</h3>
        </div>
        <p className="text-[13px] text-white/80 leading-relaxed max-w-md">
          Agriqcap is your digital financial companion for farming and small business.
          Save money in flexible or fixed accounts, build credit through consistent savings,
          and borrow against your savings balance when you need funds for inputs, equipment, or expansion.
          Every naira in your wallet is held securely with Safe Haven MFB, CBN-licensed and NDIC-insured.
        </p>
      </div>
    </div>
  );
}
