"use client";

import { Loader2 } from "lucide-react";
import { motion, HTMLMotionProps } from "framer-motion";

interface PrimaryButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  loading?: boolean;
  children?: React.ReactNode;
}

export function PrimaryButton({ children, loading, disabled, className = "", ...props }: PrimaryButtonProps) {
  return (
    <motion.button
      type="submit"
      disabled={disabled || loading}
      whileHover={{
        y: -2,
        backgroundColor: "#BBDC12",
        boxShadow: "0 6px 20px rgba(187, 220, 18, 0.35)",
      }}
      whileTap={{
        y: 0,
        boxShadow: "0 2px 8px rgba(187, 220, 18, 0.15)",
      }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{
        boxShadow: "0 2px 8px rgba(187, 220, 18, 0.15)",
      }}
      className={`w-full bg-ochre text-indigo-deep font-display font-bold text-[15px] py-4 rounded-[12px] mt-6 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : children}
    </motion.button>
  );
}
