"use client";

import { motion } from "framer-motion";

export function LexScore({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80
      ? "text-lex-green"
      : score >= 60
        ? "text-lex-amber"
        : "text-lex-red";

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center rounded-2xl border border-slate-700 bg-lex-card p-8"
    >
      <p className="text-sm uppercase tracking-widest text-slate-400">LEXSCORE</p>
      <p className={`text-7xl font-bold tabular-nums ${color}`}>{score}</p>
      <p className="mt-2 text-lg font-medium text-slate-300">{label}</p>
    </motion.div>
  );
}
