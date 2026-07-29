"use client";

import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function AuthLayout({ children, rightPanel }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 md:px-8 md:py-10"
      style={{ background: "#f0f4f0" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-[1240px] rounded-[24px] overflow-hidden shadow-2xl flex flex-row"
        style={{
          minHeight: "680px",
          boxShadow: "0 20px 60px rgba(27,94,32,0.10), 0 4px 20px rgba(0,0,0,0.04)",
        }}
      >
        {/* ── Left panel — form (55%) ── */}
        <div
          className="flex flex-col justify-center"
          style={{
            width: "55%",
            background: "#FBFDF9",
            padding: "56px 64px",
          }}
        >
          {/* Inner form wrapper — constrained width, left aligned */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            style={{ maxWidth: "500px", width: "100%" }}
          >
            {children}
          </motion.div>
        </div>

        {/* ── Right panel — full brand hero (45%) ── */}
        <div
          className="hidden md:block"
          style={{ width: "45%", position: "relative" }}
        >
          {rightPanel}
        </div>
      </motion.div>
    </div>
  );
}
