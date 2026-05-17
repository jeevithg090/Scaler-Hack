"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AgentThinking } from "@/components/AgentThinking";
import { ClauseCard } from "@/components/ClauseCard";
import { LexScore } from "@/components/LexScore";
import { getAnalysis, streamAnalysis } from "@/lib/api";
import type { LexGuardAnalysis, StreamEvent } from "@/lib/types";

export default function AnalyzePage() {
  const params = useParams();
  const id = params.id as string;
  const [active, setActive] = useState<string | null>("orchestrator");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<LexGuardAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const close = streamAnalysis(id, (ev: StreamEvent) => {
      if (ev.type === "error") {
        setError(ev.message || "Analysis failed");
        return;
      }
      if (ev.type === "complete" && ev.data) {
        setResult(ev.data);
        setActive(null);
        return;
      }
      if (ev.agent && ev.status === "running") setActive(ev.agent);
      if (ev.agent && ev.status === "complete") {
        setCompleted((prev) => new Set(prev).add(ev.agent!));
        setActive(null);
      }
    });

    getAnalysis(id)
      .then((data) => {
        if (data.status === "complete" && data.lexscore !== undefined) {
          setResult(data as LexGuardAnalysis);
        }
      })
      .catch(() => {});

    return close;
  }, [id]);

  const redFirst = result?.clauses
    ? [...result.clauses].sort((a, b) => {
        const order = { RED: 0, AMBER: 1, GREEN: 2 };
        return (order[a.verdict] ?? 3) - (order[b.verdict] ?? 3);
      })
    : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold text-white">Analysis</h1>
      <p className="mt-1 font-mono text-xs text-slate-500">{id}</p>

      {!result && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <AgentThinking active={active} completed={completed} />
          <p className="self-center text-sm text-slate-400">
            Six agents are debating your contract. This takes 30–90 seconds…
          </p>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-lg bg-red-950/50 p-4 text-lex-red">{error}</p>
      )}

      {result && (
        <div className="mt-8 space-y-8">
          <LexScore score={result.lexscore} label={result.lexscore_label} />

          <section className="rounded-xl border border-slate-700 bg-lex-card p-5">
            <h2 className="font-semibold text-white">Summary</h2>
            <p className="mt-2 text-sm text-slate-400">
              {result.summary.red_clauses} red · {result.summary.amber_clauses} amber ·{" "}
              {result.summary.green_clauses} green · {result.summary.total_clauses} clauses
            </p>
            {result.summary.critical_issues?.length > 0 && (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-lex-red">
                {result.summary.critical_issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
            {result.document_benchmark?.industry_comparison && (
              <p className="mt-4 text-sm text-slate-300">
                {result.document_benchmark.industry_comparison}
              </p>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Clause breakdown</h2>
            {redFirst.map((c) => (
              <ClauseCard key={c.clause_id} clause={c} />
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
