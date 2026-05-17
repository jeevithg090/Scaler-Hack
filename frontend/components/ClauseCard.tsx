"use client";

import type { ClauseAnalysis } from "@/lib/types";

const verdictStyles = {
  RED: "border-lex-red/50 bg-red-950/30",
  AMBER: "border-lex-amber/50 bg-amber-950/20",
  GREEN: "border-lex-green/40 bg-emerald-950/20",
};

export function ClauseCard({ clause }: { clause: ClauseAnalysis }) {
  const style = verdictStyles[clause.verdict] || verdictStyles.GREEN;

  return (
    <article className={`rounded-xl border p-5 ${style}`}>
      <motionHeader clause={clause} />
      <p className="mt-3 text-lg font-medium text-white">{clause.plain_english}</p>
      {clause.worst_case && (
        <p className="mt-2 text-sm text-slate-400">
          <span className="text-slate-500">Worst case:</span> {clause.worst_case}
        </p>
      )}
      {clause.negotiation_script && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-lex-accent">
            Negotiation script
          </summary>
          <p className="mt-2 rounded-lg bg-slate-900/80 p-3 text-sm text-slate-200">
            {clause.negotiation_script}
          </p>
        </details>
      )}
      {clause.suggested_redline && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-lex-accent">
            Suggested redline
          </summary>
          <p className="mt-2 rounded-lg bg-slate-900/80 p-3 text-sm italic text-slate-300">
            {clause.suggested_redline}
          </p>
        </details>
      )}
    </article>
  );
}

function motionHeader({ clause }: { clause: ClauseAnalysis }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono">
        {clause.clause_id}
      </span>
      <span className="text-xs uppercase text-slate-400">{clause.clause_type}</span>
      <span
        className={`ml-auto rounded px-2 py-0.5 text-xs font-bold ${
          clause.verdict === "RED"
            ? "bg-lex-red text-white"
            : clause.verdict === "AMBER"
              ? "bg-lex-amber text-black"
              : "bg-lex-green text-black"
        }`}
      >
        {clause.verdict}
      </span>
    </motionHeader>
  );
}
