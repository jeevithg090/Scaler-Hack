"use client";

import { useState } from "react";
import type { ClauseAnalysis } from "@/lib/types";
import { AudioPlayer } from "@/components/AudioPlayer";

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

const confidenceBadge: Record<string, string> = {
  HIGH: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW: "bg-slate-700/40 text-slate-300 border-slate-500/30",
};

export function ClauseCard({ clause, analysisId }: { clause: ClauseAnalysis; analysisId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = verdictConfig[clause.verdict] || verdictConfig.GREEN;

  const copyNegotiation = async () => {
    if (!clause.negotiation_script) return;
    await navigator.clipboard.writeText(clause.negotiation_script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article
      className={`rounded-xl border border-l-[3px] ${config.left} ${config.border} ${config.bg} overflow-hidden transition-all duration-300 hover:shadow-lg`}
      style={{
        boxShadow: expanded ? `0 0 24px ${config.accent}10` : "none",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${config.badge}`}>
              {clause.verdict}
            </span>
            <span
              className={`rounded border px-2 py-0.5 text-[10px] font-medium ${severityBadge[clause.severity] || severityBadge.LOW}`}
            >
              {clause.severity}
            </span>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[10px] ${confidenceBadge[clause.confidence] || confidenceBadge.MEDIUM}`}
            >
              {clause.confidence} CONFIDENCE
            </span>
            <span className="font-mono text-[10px] text-slate-600">{clause.clause_id}</span>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              {clause.clause_type?.replace(/_/g, " ")}
            </span>
          </div>

          <p className="text-[15px] font-medium leading-snug text-slate-200">{clause.plain_english}</p>

          {clause.worst_case && !expanded && (
            <p className="line-clamp-1 text-xs leading-relaxed text-slate-500">
              <span className="text-slate-600">Worst case:</span> {clause.worst_case}
            </p>
          )}
        </div>

        <span
          className="mt-1 flex-shrink-0 text-xs text-slate-600 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-800/50 px-5 pb-5 pt-4 animate-fade-in">
          {clause.original_text && (
            <div className="rounded-lg bg-slate-900/60 p-4">
              <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-slate-500">
                ORIGINAL CLAUSE
              </p>
              <p className="text-xs leading-relaxed text-slate-400 italic">&ldquo;{clause.original_text}&rdquo;</p>
            </div>
          )}

          {clause.evidence_snippet && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-slate-500">EVIDENCE SNIPPET</p>
              <p className="text-xs leading-relaxed text-slate-400">{clause.evidence_snippet}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            <p className="mb-3 font-mono text-[9px] font-bold tracking-[1.5px] text-slate-500">ADVERSARIAL TRACE</p>
            <div className="space-y-3">
              <div className="rounded-md border border-red-500/20 bg-red-950/15 p-3">
                <p className="mb-1 font-mono text-[10px] text-lex-red">1) RISK HUNTER</p>
                <p className="text-xs text-red-200">{clause.risk_hunter_argument || clause.plain_english}</p>
              </div>
              <div className="rounded-md border border-orange-500/20 bg-orange-950/10 p-3">
                <p className="mb-1 font-mono text-[10px] text-orange-300">2) DEVIL'S ADVOCATE</p>
                <p className="text-xs text-orange-100">{clause.defense_argument || "No strong defense found for this clause."}</p>
              </div>
              <div className="rounded-md border border-indigo-500/25 bg-indigo-950/10 p-3">
                <p className="mb-1 font-mono text-[10px] text-indigo-300">3) SYNTHESIS VERDICT</p>
                <p className="text-xs text-indigo-100">Final verdict: {clause.verdict}. {clause.plain_english}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {clause.worst_case && (
              <div className="rounded-lg border border-lex-red/10 bg-red-950/10 p-4">
                <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-red">WORST CASE</p>
                <p className="text-xs leading-relaxed text-slate-300">{clause.worst_case}</p>
              </div>
            )}
            {clause.defense_counterpoint && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-slate-500">DEFENSE WEAKNESS</p>
                <p className="text-xs leading-relaxed text-slate-400">{clause.defense_counterpoint}</p>
              </div>
            )}
            {(clause.verdict === "RED" || clause.verdict === "AMBER") && (
              <div className="col-span-1 flex justify-end sm:col-span-2">
                <AudioPlayer
                  endpoint={`/api/analyze/${analysisId}/voice/debate/${clause.clause_id}`}
                  buttonText="Listen to Agent Debate"
                />
              </div>
            )}
          </div>

          {clause.negotiation_script && (
            <div className="group relative rounded-lg border border-lex-accent/15 bg-lex-accent/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[9px] font-bold tracking-[1.5px] text-lex-accent">NEGOTIATION SCRIPT</p>
                <button
                  type="button"
                  onClick={copyNegotiation}
                  className="rounded-md border border-lex-accent/20 px-2 py-1 font-mono text-[10px] text-lex-accent hover:bg-lex-accent/10"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-indigo-200 italic">{clause.negotiation_script}</p>
              <AudioPlayer
                endpoint={`/api/analyze/${analysisId}/voice/negotiate/${clause.clause_id}`}
                buttonText="Hear How to Say It"
                size="sm"
              />
            </div>
          )}

          {clause.suggested_redline && (
            <div className="rounded-lg border border-lex-green/15 bg-emerald-950/10 p-4">
              <p className="mb-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-green">SUGGESTED REDLINE</p>
              <p className="text-xs leading-relaxed text-emerald-200">{clause.suggested_redline}</p>
            </div>
          )}

          {clause.industry_norm && <p className="font-mono text-[11px] text-slate-600">⚖ {clause.industry_norm}</p>}
        </div>
      )}
    </article>
  );
}
