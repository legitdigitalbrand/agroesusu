"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "dark" | "light" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`relative inline-flex items-center gap-2 rounded-full border p-1 transition-colors ${className}`}
      style={{
        background: "var(--surface-card)",
        borderColor: "var(--border-default)",
      }}
    >
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
          theme === "light" ? "opacity-100" : "opacity-30"
        }`}
        style={theme === "light" ? { background: "var(--accent-subtle)" } : {}}
      >
        <SunIcon className="w-4 h-4" style={{ color: theme === "light" ? "var(--accent)" : "var(--text-muted)" }} />
      </span>
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
          theme === "dark" ? "opacity-100" : "opacity-30"
        }`}
        style={theme === "dark" ? { background: "var(--accent-subtle)" } : {}}
      >
        <MoonIcon className="w-4 h-4" style={{ color: theme === "dark" ? "var(--accent)" : "var(--text-muted)" }} />
      </span>
    </button>
  );
}
