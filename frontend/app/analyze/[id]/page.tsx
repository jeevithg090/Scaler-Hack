"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AgentThinking } from "@/components/AgentThinking";
import { ClauseCard } from "@/components/ClauseCard";
import { LexScore } from "@/components/LexScore";
import { AudioPlayer } from "@/components/AudioPlayer";
import { VoiceWidget } from "@/components/VoiceWidget";
import {
  downloadNegotiationPack,
  getAnalysis,
  sendChatMessage,
  streamAnalysis,
} from "@/lib/api";
import type { LexGuardAnalysis, StreamEvent } from "@/lib/types";

type Filter = "ALL" | "RED" | "AMBER" | "GREEN";

const formatMessage = (content: string) => {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

const scoreLabel = (score: number): string => {
  if (score <= 19) return "HOSTILE";
  if (score <= 39) return "PREDATORY";
  if (score <= 59) return "HIGH_RISK";
  if (score <= 79) return "MODERATE";
  if (score <= 89) return "GOOD";
  return "EXCELLENT";
};

const severityPenalty: Record<string, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 4,
  LOW: 1,
  CLEAN: 0,
};

export default function AnalyzePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const compareId = searchParams.get("compare");

  const [active, setActive] = useState<string | null>("orchestrator");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<LexGuardAnalysis | null>(null);
  const [compareResult, setCompareResult] = useState<LexGuardAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [packLoading, setPackLoading] = useState<"md" | "txt" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [simResolved, setSimResolved] = useState<Set<string>>(new Set());

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

    if (compareId) {
      getAnalysis(compareId)
        .then((data) => {
          if (data.status === "complete" && data.lexscore !== undefined) {
            setCompareResult(data as LexGuardAnalysis);
          }
        })
        .catch(() => {});
    }

    return close;
  }, [id, compareId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const riskyClauses = useMemo(
    () =>
      (result?.clauses || []).filter((c) => c.verdict === "RED" || c.verdict === "AMBER"),
    [result]
  );

  const projectedScore = useMemo(() => {
    if (!result) return 0;
    let uplift = 0;
    for (const clause of riskyClauses) {
      if (simResolved.has(clause.clause_id)) {
        uplift += severityPenalty[clause.severity] || 0;
      }
    }
    return Math.min(100, result.lexscore + uplift);
  }, [result, riskyClauses, simResolved]);

  const projectedLabel = useMemo(() => scoreLabel(projectedScore), [projectedScore]);

  const filteredClauses = result?.clauses
    ? [...result.clauses]
        .filter((c) => filter === "ALL" || c.verdict === filter)
        .sort((a, b) => {
          const order = { RED: 0, AMBER: 1, GREEN: 2 };
          return (order[a.verdict] ?? 3) - (order[b.verdict] ?? 3);
        })
    : [];

  const checklist = useMemo(() => {
    if (!result) return [];
    return riskyClauses.slice(0, 5).map((c) => ({
      id: c.clause_id,
      item: `Ask to revise ${c.clause_id} (${c.clause_type.replace(/_/g, " ")}) using the suggested redline.`,
    }));
  }, [result, riskyClauses]);

  const handlePackDownload = async (format: "md" | "txt") => {
    setPackLoading(format);
    try {
      const blob = await downloadNegotiationPack(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lexguard-negotiation-pack-${id.slice(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download pack");
    } finally {
      setPackLoading(null);
    }
  };

  const copyShareLink = async () => {
    const link = typeof window !== "undefined" ? window.location.href : "";
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const reply = await sendChatMessage(id, msg);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that. Try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const planTone = result?.action_plan?.recommendation === "WALK_AWAY"
    ? "border-lex-red/30 bg-red-950/15 text-red-200"
    : result?.action_plan?.recommendation === "SIGN"
      ? "border-lex-green/30 bg-emerald-950/15 text-emerald-200"
      : "border-amber-500/30 bg-amber-950/15 text-amber-200";

  return (
    <div className="min-h-screen">
      <nav className="glass-strong fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between px-4 md:px-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lex-accent to-indigo-400">
            <span className="text-xs font-bold text-white">⚖</span>
          </div>
          <span className="font-mono text-sm font-bold tracking-[3px] text-slate-200">LEXGUARD</span>
        </Link>
        <div className="flex items-center gap-2 md:gap-3">
          {result && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="rounded-lg border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-400 transition-all hover:border-lex-accent hover:text-lex-accent md:text-xs"
            >
              💬 Ask Contract
            </button>
          )}
          <Link
            href="/"
            className="rounded-lg bg-lex-accent/10 px-3 py-2 text-[10px] font-medium text-lex-accent transition-all hover:bg-lex-accent/20 md:text-xs"
          >
            + New
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 md:px-6">
        {!result && !error && (
          <div className="mt-8 animate-fade-in-up">
            <h1 className="mb-2 text-2xl font-bold text-white">Analyzing your contract…</h1>
            <p className="mb-8 font-mono text-xs text-slate-600">{id}</p>
            <div className="grid gap-8 md:grid-cols-2">
              <AgentThinking active={active} completed={completed} />
              <div className="flex flex-col justify-center rounded-2xl border border-slate-800 bg-lex-card/50 p-8">
                <div className="mb-4 animate-float text-4xl">⚖</div>
                <h2 className="mb-2 text-lg font-semibold text-white">Adversarial Analysis</h2>
                <p className="text-sm leading-relaxed text-slate-500">
                  Six AI agents are debating every clause, then producing redlines and negotiation scripts.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 animate-fade-in-up rounded-xl border border-lex-red/20 bg-lex-red/5 p-6 text-center">
            <p className="text-lg font-semibold text-lex-red">Analysis Failed</p>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-lex-accent px-6 py-2 text-sm font-medium text-white"
            >
              Try Again
            </Link>
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-6 animate-fade-in-up">
            <div className={`rounded-2xl border p-5 ${planTone}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs tracking-wider">ACTION PLAN</span>
                <span className="rounded border border-white/20 bg-black/20 px-2 py-0.5 font-mono text-[10px]">
                  {result.action_plan?.recommendation?.replace(/_/g, " ")}
                </span>
                <span className="rounded border border-white/20 bg-black/20 px-2 py-0.5 font-mono text-[10px]">
                  URGENCY {result.action_plan?.urgency}
                </span>
              </div>
              <p className="text-sm">{result.action_plan?.rationale}</p>
              <p className="mt-2 text-xs text-white/80">
                If ignored: {result.action_plan?.downside_if_ignored}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(result.action_plan?.next_steps || []).map((step, i) => (
                  <span key={`${i}-${step}`} className="rounded-lg bg-black/20 px-2.5 py-1 text-xs text-white/90">
                    {i + 1}. {step}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
              <div className="space-y-4">
                <LexScore score={result.lexscore} label={result.lexscore_label} />
                <div className="rounded-2xl border border-slate-800 bg-lex-card/80 p-4">
                  <p className="mb-2 font-mono text-[10px] tracking-wider text-slate-500">SCORE SIMULATOR</p>
                  <p className="text-xs text-slate-500">If negotiation succeeds on selected clauses:</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="font-mono text-3xl text-lex-green">{projectedScore}</span>
                    <span className="text-xs text-slate-400">({projectedLabel.replace(/_/g, " ")})</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {riskyClauses.slice(0, 6).map((clause) => (
                      <label key={clause.clause_id} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800 bg-slate-900/40 p-2">
                        <input
                          type="checkbox"
                          checked={simResolved.has(clause.clause_id)}
                          onChange={(e) => {
                            setSimResolved((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(clause.clause_id);
                              else next.delete(clause.clause_id);
                              return next;
                            });
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-xs text-slate-300">
                          {clause.clause_id}: {clause.clause_type.replace(/_/g, " ")}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-lex-card/80 p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-200">Document Summary</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <AudioPlayer endpoint={`/api/analyze/${id}/voice/briefing`} buttonText="Audio Briefing" size="sm" />
                      <button
                        onClick={copyShareLink}
                        className="rounded border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-lex-accent/50"
                      >
                        {linkCopied ? "Link Copied" : "Copy Report Link"}
                      </button>
                      <button
                        onClick={() => handlePackDownload("md")}
                        disabled={packLoading !== null}
                        className="rounded border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-lex-accent/50 disabled:opacity-40"
                      >
                        {packLoading === "md" ? "Building…" : "Export Pack (.md)"}
                      </button>
                      <button
                        onClick={() => handlePackDownload("txt")}
                        disabled={packLoading !== null}
                        className="rounded border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-lex-accent/50 disabled:opacity-40"
                      >
                        {packLoading === "txt" ? "Building…" : "Export Pack (.txt)"}
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Total", count: result.summary.total_clauses, color: "#6366f1" },
                      { label: "Critical", count: result.summary.red_clauses, color: "#ef4444" },
                      { label: "Warning", count: result.summary.amber_clauses, color: "#f59e0b" },
                      { label: "Clear", count: result.summary.green_clauses, color: "#22c55e" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
                        <p className="font-mono text-xl font-bold" style={{ color: s.color }}>
                          {s.count}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <p className="mb-2 font-mono text-[10px] text-slate-500">RISK TAXONOMY</p>
                      <div className="space-y-1 text-xs text-slate-300">
                        {Object.entries(result.risk_taxonomy_counts || {}).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <span>{k.replace(/_/g, " ")}</span>
                            <span className="font-mono">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/10 p-3">
                      <p className="mb-2 font-mono text-[10px] text-indigo-300">WHY ADVERSARIAL &gt; SINGLE AGENT</p>
                      <div className="space-y-1 text-xs text-indigo-200">
                        <p>Disagreements surfaced: {result.adversarial_metrics?.disagreements_count ?? 0}</p>
                        <p>Defenses overturned: {result.adversarial_metrics?.defenses_overturned ?? 0}</p>
                        <p>Defensible clauses retained: {result.adversarial_metrics?.defensible_clauses ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  {result.summary.critical_issues?.length > 0 && (
                    <div className="mt-4 rounded-lg border border-lex-red/15 bg-red-950/10 p-4">
                      <p className="mb-2 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-red">⚠ TOP CRITICAL ISSUES</p>
                      <ul className="space-y-1.5">
                        {result.summary.critical_issues.map((issue: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-red-300">
                            <span className="mt-0.5 text-lex-red">▸</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {result.document_benchmark?.industry_comparison && (
                  <div className="rounded-2xl border border-slate-800 bg-lex-card/80 p-6">
                    <div className="mb-2 flex items-baseline gap-3">
                      <span className="font-mono text-3xl font-bold text-lex-red">{result.document_benchmark.percentile}th</span>
                      <span className="text-sm text-slate-500">risk percentile</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">{result.document_benchmark.industry_comparison}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${result.document_benchmark.percentile}%`,
                          background: "linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {result.raw_meta?.orchestrator?.jurisdiction_hints?.length ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 text-xs text-slate-400">
                    Jurisdiction hints detected: {result.raw_meta.orchestrator.jurisdiction_hints.join(", ")}. Legal enforceability may vary by region.
                  </div>
                ) : null}

                {checklist.length > 0 && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
                    <p className="mb-2 font-mono text-[10px] tracking-wider text-emerald-300">ASK ME BEFORE I SIGN CHECKLIST</p>
                    <div className="space-y-2">
                      {checklist.map((item) => (
                        <div key={item.id} className="rounded-md border border-emerald-500/20 bg-black/20 p-2 text-xs text-emerald-100">
                          {item.item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {compareResult && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
                <p className="mb-3 font-mono text-[10px] tracking-wider text-slate-400">COMPARE TWO OFFERS (BETA)</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Current Analysis ({id.slice(0, 8)})</p>
                    <p className="font-mono text-2xl text-lex-accent">{result.lexscore}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Compared Analysis ({compareId?.slice(0, 8)})</p>
                    <p className="font-mono text-2xl text-emerald-300">{compareResult.lexscore}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-300">
                  Delta: {result.lexscore - compareResult.lexscore > 0 ? "+" : ""}
                  {result.lexscore - compareResult.lexscore} points. Higher score is safer.
                </p>
              </div>
            )}

            {result.missing_protections?.length > 0 && (
              <div className="rounded-2xl border border-indigo-500/15 bg-indigo-950/10 p-6">
                <p className="mb-3 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-accent">⬡ MISSING PROTECTIONS</p>
                <div className="flex flex-wrap gap-2">
                  {result.missing_protections.map((p: string, i: number) => (
                    <span
                      key={i}
                      className="rounded-lg border border-lex-accent/15 bg-lex-accent/5 px-3 py-1.5 text-xs text-indigo-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Clause Breakdown</h2>
              <div className="flex gap-1 rounded-lg border border-slate-800 bg-lex-card/50 p-1">
                {(["ALL", "RED", "AMBER", "GREEN"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider transition-all ${
                      filter === f
                        ? f === "RED"
                          ? "bg-lex-red/15 text-lex-red"
                          : f === "AMBER"
                            ? "bg-lex-amber/15 text-lex-amber"
                            : f === "GREEN"
                              ? "bg-lex-green/15 text-lex-green"
                              : "bg-lex-accent/15 text-lex-accent"
                        : "text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="stagger-children space-y-3">
              {filteredClauses.map((c) => (
                <ClauseCard key={c.clause_id} clause={c} analysisId={id} />
              ))}
              {filteredClauses.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600">No {filter.toLowerCase()} clauses found.</p>
              )}
            </div>
          </div>
        )}
      </main>

      {chatOpen && result && (
        <div className="fixed bottom-0 right-0 z-50 w-full max-w-md animate-fade-in-up md:bottom-6 md:right-6">
          <div className="flex h-[28rem] flex-col rounded-t-2xl border border-slate-700 bg-lex-bg shadow-2xl md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Ask about this contract</p>
                <p className="text-[10px] text-slate-500">LEXSCORE {result.lexscore} · {result.summary.total_clauses} clauses</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800">
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Try asking:</p>
                  {[
                    "What is the single most dangerous clause?",
                    "Which 2 edits will raise my score fastest?",
                    "Draft one email to negotiate all red clauses.",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setChatInput(q);
                      }}
                      className="block w-full rounded-lg border border-slate-800 px-3 py-2 text-left text-xs text-slate-400 transition-colors hover:border-lex-accent/30 hover:bg-lex-accent/5"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap rounded-xl px-4 py-3 text-xs leading-relaxed ${
                    msg.role === "user" ? "ml-8 bg-lex-accent/10 text-indigo-200" : "mr-8 bg-slate-800 text-slate-300"
                  }`}
                >
                  {formatMessage(msg.content)}
                </div>
              ))}
              {chatLoading && (
                <div className="mr-8 rounded-xl bg-slate-800 px-4 py-3 text-xs text-slate-500">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-slate-400" /> Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChat} className="border-t border-slate-800 px-4 py-3">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this contract…"
                  className="flex-1 rounded-lg border border-slate-800 bg-lex-card/50 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-lex-accent/30 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-lg bg-lex-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-30"
                >
                  →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {result && process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID && (
        <VoiceWidget
          agentId={process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID}
          analysisId={id}
        />
      )}
    </div>
  );
}
