"use client";

import { useState } from "react";
import type { ClauseAnalysis } from "@/lib/types";

const verdictConfig = {
  RED: {
    border: "border-lex-red/30",
    bg: "bg-red-950/20",
    badge: "bg-lex-red text-white",
    accent: "#ef4444",
    left: "border-l-lex-red",
  },
  AMBER: {
    border: "border-lex-amber/30",
    bg: "bg-amber-950/15",
    badge: "bg-lex-amber text-black",
    accent: "#f59e0b",
    left: "border-l-lex-amber",
  },
  GREEN: {
    border: "border-lex-green/25",
    bg: "bg-emerald-950/15",
    badge: "bg-lex-green text-black",
    accent: "#22c55e",
    left: "border-l-lex-green",
  },
};

const severityBadge: Record<string, string> = {
  CRITICAL: "bg-red-900/40 text-lex-red border-lex-red/20",
  HIGH: "bg-orange-900/30 text-orange-400 border-orange-400/20",
  MEDIUM: "bg-amber-900/20 text-lex-amber border-lex-amber/20",
  LOW: "bg-slate-800 text-slate-400 border-slate-600/20",
  CLEAN: "bg-emerald-900/20 text-lex-green border-lex-green/20",
};

export function ClauseCard({ clause }: { clause: ClauseAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const config = verdictConfig[clause.verdict] || verdictConfig.GREEN;

  return (
    <article
      className={`rounded-xl border border-l-[3px] ${config.left} ${config.border} ${config.bg} overflow-hidden transition-all duration-300 hover:shadow-lg`}
      style={{
        boxShadow: expanded ? `0 0 24px ${config.accent}10` : "none",
      }}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        <div className="flex flex-1 flex-col gap-2">
          {/* Top row: badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${config.badge}`}
            >
              {clause.verdict}
            </span>
            <span
              className={`rounded border px-2 py-0.5 text-[10px] font-medium ${severityBadge[clause.severity] || severityBadge.LOW}`}
            >
              {clause.severity}
            </span>
            <span className="font-mono text-[10px] text-slate-600">
              {clause.clause_id}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              {clause.clause_type?.replace(/_/g, " ")}
            </span>
          </div>

          {/* Plain English */}
          <p className="text-[15px] font-medium leading-snug text-slate-200">
            {clause.plain_english}
          </p>

          {/* Worst case preview */}
          {clause.worst_case && !expanded && (
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-1">
              <span className="text-slate-600">Worst case:</span>{" "}
              {clause.worst_case}
            </p>
          )}
        </div>

        {/* Expand icon */}
        <span className="mt-1 flex-shrink-0 text-xs text-slate-600 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="animate-fade-in border-t border-slate-800/50 px-5 pb-5 pt-4 space-y-4">
          {/* Original clause text */}
          {clause.original_text && (
            <div className="rounded-lg bg-slate-900/60 p-4">
              <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-slate-500">
                ORIGINAL CLAUSE
              </p>
              <p className="text-xs leading-relaxed text-slate-400 italic">
                &ldquo;{clause.original_text}&rdquo;
              </p>
            </div>
          )}

          {/* Risk & worst case grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {clause.worst_case && (
              <div className="rounded-lg border border-lex-red/10 bg-red-950/10 p-4">
                <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-red">
                  WORST CASE
                </p>
                <p className="text-xs leading-relaxed text-slate-300">
                  {clause.worst_case}
                </p>
              </div>
            )}
            {clause.defense_argument && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-slate-500">
                  DEVIL&apos;S ADVOCATE ({clause.defense_strength})
                </p>
                <p className="text-xs leading-relaxed text-slate-400">
                  {clause.defense_argument}
                </p>
              </div>
            )}
          </div>

          {/* Negotiation script */}
          {clause.negotiation_script && (
            <div className="rounded-lg border border-lex-accent/15 bg-lex-accent/5 p-4">
              <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-accent">
                NEGOTIATION SCRIPT
              </p>
              <p className="text-sm leading-relaxed text-indigo-200 italic">
                {clause.negotiation_script}
              </p>
            </div>
          )}

          {/* Suggested redline */}
          {clause.suggested_redline && (
            <div className="rounded-lg border border-lex-green/15 bg-emerald-950/10 p-4">
              <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-green">
                SUGGESTED REDLINE
              </p>
              <p className="text-xs leading-relaxed text-emerald-200">
                {clause.suggested_redline}
              </p>
            </div>
          )}

          {/* Industry norm */}
          {clause.industry_norm && (
            <p className="font-mono text-[11px] text-slate-600">
              ⚖ {clause.industry_norm}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
