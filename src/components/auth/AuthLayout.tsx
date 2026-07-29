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
        className="w-full max-w-[1240px] rounded-[20px] md:rounded-[24px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
        style={{
          minHeight: "min(680px, 100vh)",
          boxShadow: "0 20px 60px rgba(27,94,32,0.10), 0 4px 20px rgba(0,0,0,0.04)",
        }}
      >
        {/* ── Left panel — form ──
            Mobile:  100% width, px-6 py-10
            Desktop: 55% width, px-16 py-14
        */}
        <div
          className="flex flex-col justify-center w-full md:w-[55%] px-6 py-10 md:px-16 md:py-14"
          style={{ background: "#FBFDF9" }}
        >
          {/* Inner form wrapper — constrained width, left aligned */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="w-full max-w-[500px]"
          >
            {children}
          </motion.div>
        </div>

        {/* ── Right panel — full brand hero (45%) ──
            Mobile:  hidden
            Desktop: 45% width, fills entire right column
        */}
        <div className="hidden md:block md:w-[45%] relative">
          {rightPanel}
        </div>
      </motion.div>
    </div>
  );
}
