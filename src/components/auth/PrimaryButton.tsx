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
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`w-full bg-ochre text-indigo-deep font-display font-bold text-[15px] py-3 rounded-[12px] mt-4 hover:bg-ochre-light transition disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : children}
    </motion.button>
  );
}
