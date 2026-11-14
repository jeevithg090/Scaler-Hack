"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import type { ClauseAnalysis } from "@/lib/types";
import { AudioPlayer } from "@/components/AudioPlayer";

const verdictConfig = {
  RED: {
    border: "border-lex-red/30",
    bg: "bg-red-950/20",
    badge: "bg-red-600 text-white",
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
  CRITICAL: "bg-red-900/40 text-red-300 border-lex-red/30",
  HIGH: "bg-orange-900/30 text-orange-300 border-orange-400/30",
  MEDIUM: "bg-amber-900/20 text-amber-300 border-lex-amber/30",
  LOW: "bg-slate-800 text-slate-300 border-slate-600/30",
  CLEAN: "bg-emerald-900/20 text-green-300 border-lex-green/30",
};

const confidenceBadge: Record<string, string> = {
  HIGH: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW: "bg-slate-700/40 text-slate-300 border-slate-500/30",
};

export function ClauseCard({
  clause,
  analysisId,
  voiceEnabled = false,
}: {
  clause: ClauseAnalysis;
  analysisId: string;
  voiceEnabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = useId();
  const config = verdictConfig[clause.verdict] || verdictConfig.GREEN;

  const copyNegotiation = async () => {
    if (!clause.negotiation_script) return;
    try {
      await navigator.clipboard.writeText(clause.negotiation_script);
    } catch {
      return;
    }
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
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 rounded-xl p-4 text-left sm:p-5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-2xs font-bold tracking-wider ${config.badge}`}
            >
              {clause.verdict}
            </span>
            <span
              className={`rounded border px-2 py-0.5 text-2xs font-medium ${severityBadge[clause.severity] || severityBadge.LOW}`}
            >
              {clause.severity}
            </span>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-2xs ${confidenceBadge[clause.confidence] || confidenceBadge.MEDIUM}`}
            >
              {clause.confidence} CONFIDENCE
            </span>
            <span className="font-mono text-2xs text-slate-400">{clause.clause_id}</span>
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              {clause.clause_type?.replace(/_/g, " ")}
            </span>
          </div>

          <p className="text-[15px] font-medium leading-snug text-slate-200">
            {clause.plain_english}
          </p>

          {clause.worst_case && !expanded && (
            <p className="line-clamp-1 text-xs leading-relaxed text-slate-400">
              <span className="text-slate-400">Worst case:</span> {clause.worst_case}
            </p>
          )}
        </div>

        <ChevronDown
          aria-hidden="true"
          className={`mt-1 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
        <span className="sr-only">{expanded ? "Hide details" : "Show details"}</span>
      </button>

      {expanded && (
        <div
          id={panelId}
          className="space-y-4 border-t border-slate-800/50 px-4 pb-5 pt-4 animate-fade-in sm:px-5"
        >
          {clause.original_text && (
            <div className="rounded-lg bg-slate-900/60 p-4">
              <p className="mb-1.5 font-mono text-2xs font-bold tracking-[1.5px] text-slate-400">
                ORIGINAL CLAUSE
              </p>
              <p className="text-xs leading-relaxed text-slate-400 italic">
                &ldquo;{clause.original_text}&rdquo;
              </p>
            </div>
          )}

          {clause.evidence_snippet && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <p className="mb-1.5 font-mono text-2xs font-bold tracking-[1.5px] text-slate-400">
                EVIDENCE SNIPPET
              </p>
              <p className="text-xs leading-relaxed text-slate-400">{clause.evidence_snippet}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            <p className="mb-3 font-mono text-2xs font-bold tracking-[1.5px] text-slate-400">
              ADVERSARIAL TRACE
            </p>
            <div className="space-y-3">
              <div className="rounded-md border border-red-500/20 bg-red-950/15 p-3">
                <p className="mb-1 font-mono text-2xs text-red-300">1) RISK HUNTER</p>
                <p className="text-xs text-red-200">
                  {clause.risk_hunter_argument || clause.plain_english}
                </p>
              </div>
              <div className="rounded-md border border-orange-500/20 bg-orange-950/10 p-3">
                <p className="mb-1 font-mono text-2xs text-orange-300">2) DEVIL&apos;S ADVOCATE</p>
                <p className="text-xs text-orange-100">
                  {clause.defense_argument || "No strong defense found for this clause."}
                </p>
              </div>
              <div className="rounded-md border border-indigo-500/25 bg-indigo-950/10 p-3">
                <p className="mb-1 font-mono text-2xs text-indigo-300">3) SYNTHESIS VERDICT</p>
                <p className="text-xs text-indigo-100">
                  Final verdict: {clause.verdict}. {clause.plain_english}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {clause.worst_case && (
              <div className="rounded-lg border border-lex-red/10 bg-red-950/10 p-4">
                <p className="mb-1.5 font-mono text-2xs font-bold tracking-[1.5px] text-red-300">
                  WORST CASE
                </p>
                <p className="text-xs leading-relaxed text-slate-300">{clause.worst_case}</p>
              </div>
            )}
            {clause.defense_counterpoint && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                <p className="mb-1.5 font-mono text-2xs font-bold tracking-[1.5px] text-slate-400">
                  DEFENSE WEAKNESS
                </p>
                <p className="text-xs leading-relaxed text-slate-400">
                  {clause.defense_counterpoint}
                </p>
              </div>
            )}
            {voiceEnabled && (clause.verdict === "RED" || clause.verdict === "AMBER") && (
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
                <p className="font-mono text-2xs font-bold tracking-[1.5px] text-lex-accent-soft">
                  NEGOTIATION SCRIPT
                </p>
                <button
                  type="button"
                  onClick={copyNegotiation}
                  aria-label={
                    copied ? "Script copied" : `Copy negotiation script for ${clause.clause_id}`
                  }
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-lex-accent/30 px-3 font-mono text-2xs text-lex-accent-soft hover:bg-lex-accent/10"
                >
                  {copied ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-indigo-200 italic">
                {clause.negotiation_script}
              </p>
              {voiceEnabled && (
                <AudioPlayer
                  endpoint={`/api/analyze/${analysisId}/voice/negotiate/${clause.clause_id}`}
                  buttonText="Hear How to Say It"
                  size="sm"
                />
              )}
            </div>
          )}

          {clause.suggested_redline && (
            <div className="rounded-lg border border-lex-green/15 bg-emerald-950/10 p-4">
              <p className="mb-1.5 font-mono text-2xs font-bold tracking-[1.5px] text-green-300">
                SUGGESTED REDLINE
              </p>
              <p className="text-xs leading-relaxed text-emerald-200">{clause.suggested_redline}</p>
            </div>
          )}

          {clause.industry_norm && (
            <p className="font-mono text-[11px] text-slate-400">⚖ {clause.industry_norm}</p>
          )}
        </div>
      )}
    </article>
  );
}
