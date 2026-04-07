"use client";

import { type ReactNode } from "react";

import { m as motion } from "framer-motion";

type TileProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Tile({ children, className = "", delay = 0 }: TileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 26, delay }}
      className={[
        "rounded-[24px] border border-white/20 border-t-white/40 bg-white/10 shadow-[0_18px_60px_rgba(15,23,42,0.12)]",
        "backdrop-blur-xl supports-[backdrop-filter]:bg-white/10",
        className
      ].join(" ")}
    >
      {children}
    </motion.div>
  );
}
