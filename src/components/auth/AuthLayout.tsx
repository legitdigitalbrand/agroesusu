"use client";

import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function AuthLayout({ children, rightPanel }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8" style={{ background: "#f0f4f0" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[1100px] rounded-[20px] overflow-hidden border border-border-line shadow-lg flex flex-row"
        style={{ minHeight: "540px" }}
      >
        {/* Left panel — form (55%) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex-[0_0_55%] flex flex-col justify-center p-9"
          style={{ background: "#FBFDF9" }}
        >
          {children}
        </motion.div>

        {/* Right panel — brand (45%), hidden on mobile */}
        <div className="hidden md:flex flex-1">
          {rightPanel}
        </div>
      </motion.div>
    </div>
  );
}
