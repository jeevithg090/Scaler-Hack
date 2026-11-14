"use client";

import { useEffect, useState } from "react";
import type { ClauseAnalysis } from "@/lib/types";

export function RedlineModal({ clause, onClose }: { clause: ClauseAnalysis; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(clause.suggested_redline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Suggested redline for ${clause.clause_id}`}
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-lex-bg p-6 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[1.5px] text-lex-green">
              SUGGESTED REDLINE
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {clause.clause_id} · {clause.clause_type?.replace(/_/g, " ")}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-2 text-xs text-slate-500 transition-colors hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Original */}
        <div className="mb-4 rounded-lg bg-red-950/15 border border-lex-red/10 p-4">
          <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-red">
            ORIGINAL
          </p>
          <p className="text-xs leading-relaxed text-slate-400 italic line-through decoration-lex-red/30">
            {clause.original_text}
          </p>
        </div>

        {/* Redline */}
        <div className="mb-4 rounded-lg bg-emerald-950/15 border border-lex-green/10 p-4">
          <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-green">
            SUGGESTED REPLACEMENT
          </p>
          <p className="text-sm leading-relaxed text-emerald-200">{clause.suggested_redline}</p>
        </div>

        <button
          onClick={handleCopy}
          className="w-full rounded-xl bg-gradient-to-r from-lex-green/80 to-emerald-600/80 py-3 text-sm font-bold text-white transition-all hover:from-lex-green hover:to-emerald-600"
        >
          {copied ? "✓ Copied to Clipboard!" : "Copy Redline Text"}
        </button>
      </div>
    </div>
  );
}
