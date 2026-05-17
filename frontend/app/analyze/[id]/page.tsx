"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgentThinking } from "@/components/AgentThinking";
import { ClauseCard } from "@/components/ClauseCard";
import { LexScore } from "@/components/LexScore";
import { getAnalysis, streamAnalysis, sendChatMessage } from "@/lib/api";
import type { LexGuardAnalysis, StreamEvent } from "@/lib/types";

type Filter = "ALL" | "RED" | "AMBER" | "GREEN";

export default function AnalyzePage() {
  const params = useParams();
  const id = params.id as string;
  const [active, setActive] = useState<string | null>("orchestrator");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<LexGuardAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  // Chat state
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

    // Also try fetching directly (for page refreshes)
    getAnalysis(id)
      .then((data) => {
        if (data.status === "complete" && data.lexscore !== undefined) {
          setResult(data as LexGuardAnalysis);
        }
      })
      .catch(() => {});

    return close;
  }, [id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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

  const filteredClauses = result?.clauses
    ? [...result.clauses]
        .filter((c) => filter === "ALL" || c.verdict === filter)
        .sort((a, b) => {
          const order = { RED: 0, AMBER: 1, GREEN: 2 };
          return (order[a.verdict] ?? 3) - (order[b.verdict] ?? 3);
        })
    : [];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="glass-strong fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 md:px-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lex-accent to-indigo-400">
            <span className="text-xs font-bold text-white">⚖</span>
          </div>
          <span className="font-mono text-sm font-bold tracking-[3px] text-slate-200">
            LEXGUARD
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {result && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-400 transition-all hover:border-lex-accent hover:text-lex-accent"
            >
              💬 Ask about this contract
            </button>
          )}
          <Link
            href="/"
            className="rounded-lg bg-lex-accent/10 px-4 py-2 text-xs font-medium text-lex-accent transition-all hover:bg-lex-accent/20"
          >
            + New Analysis
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        {/* Loading state */}
        {!result && !error && (
          <div className="mt-8 animate-fade-in-up">
            <h1 className="mb-2 text-2xl font-bold text-white">
              Analyzing your contract…
            </h1>
            <p className="mb-8 font-mono text-xs text-slate-600">{id}</p>
            <div className="grid gap-8 md:grid-cols-2">
              <AgentThinking active={active} completed={completed} />
              <div className="flex flex-col justify-center rounded-2xl border border-slate-800 bg-lex-card/50 p-8">
                <div className="mb-4 text-4xl animate-float">⚖</div>
                <h2 className="mb-2 text-lg font-semibold text-white">
                  Adversarial Analysis
                </h2>
                <p className="text-sm leading-relaxed text-slate-500">
                  Six AI agents are debating every clause — finding risks,
                  steelmanning defenses, and generating your negotiation scripts.
                  This takes 30–90 seconds.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
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

        {/* Results */}
        {result && (
          <div className="mt-4 space-y-8 animate-fade-in-up">
            {/* Top row: Score + Summary */}
            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <LexScore score={result.lexscore} label={result.lexscore_label} />

              <div className="space-y-4">
                {/* Summary card */}
                <div className="rounded-2xl border border-slate-800 bg-lex-card/80 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-200">
                      Document Summary
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        {result.doc_type?.replace(/_/g, " ")}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        {result.weaker_party}
                      </span>
                    </div>
                  </div>

                  {/* Clause counts */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Total", count: result.summary.total_clauses, color: "#6366f1" },
                      { label: "Critical", count: result.summary.red_clauses, color: "#ef4444" },
                      { label: "Warning", count: result.summary.amber_clauses, color: "#f59e0b" },
                      { label: "Clear", count: result.summary.green_clauses, color: "#22c55e" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center"
                      >
                        <p
                          className="font-mono text-xl font-bold"
                          style={{ color: s.color }}
                        >
                          {s.count}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Critical issues */}
                  {result.summary.critical_issues?.length > 0 && (
                    <div className="rounded-lg border border-lex-red/15 bg-red-950/10 p-4">
                      <p className="mb-2 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-red">
                        ⚠ TOP CRITICAL ISSUES
                      </p>
                      <ul className="space-y-1.5">
                        {result.summary.critical_issues.map(
                          (issue: string, i: number) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs leading-relaxed text-red-300"
                            >
                              <span className="mt-0.5 text-lex-red">▸</span>
                              {issue}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Benchmark */}
                {result.document_benchmark?.industry_comparison && (
                  <div className="rounded-2xl border border-slate-800 bg-lex-card/80 p-6">
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="font-mono text-3xl font-bold text-lex-red">
                        {result.document_benchmark.percentile}th
                      </span>
                      <span className="text-sm text-slate-500">
                        percentile for risk
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {result.document_benchmark.industry_comparison}
                    </p>
                    <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${result.document_benchmark.percentile}%`,
                          background:
                            "linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Missing protections */}
            {result.missing_protections?.length > 0 && (
              <div className="rounded-2xl border border-indigo-500/15 bg-indigo-950/10 p-6">
                <p className="mb-3 font-mono text-[9px] font-bold tracking-[1.5px] text-lex-accent">
                  ⬡ MISSING PROTECTIONS
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.missing_protections.map(
                    (p: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-lg border border-lex-accent/15 bg-lex-accent/5 px-3 py-1.5 text-xs text-indigo-300"
                      >
                        {p}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Clause filter tabs */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Clause Breakdown
              </h2>
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

            {/* Clause cards */}
            <div className="stagger-children space-y-3">
              {filteredClauses.map((c) => (
                <ClauseCard key={c.clause_id} clause={c} />
              ))}
              {filteredClauses.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600">
                  No {filter.toLowerCase()} clauses found.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Chat panel ───────────────────────────── */}
      {chatOpen && result && (
        <div className="fixed bottom-0 right-0 z-50 w-full max-w-md animate-fade-in-up md:bottom-6 md:right-6">
          <div className="flex h-[28rem] flex-col rounded-t-2xl border border-slate-700 bg-lex-bg shadow-2xl md:rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Ask about this contract
                </p>
                <p className="text-[10px] text-slate-500">
                  LEXSCORE {result.lexscore} · {result.summary.total_clauses} clauses
                </p>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Try asking:</p>
                  {[
                    "What's the most dangerous clause?",
                    "How should I negotiate the non-compete?",
                    "Is the IP assignment normal?",
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
                  className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "ml-8 bg-lex-accent/10 text-indigo-200"
                      : "mr-8 bg-slate-800 text-slate-300"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="mr-8 rounded-xl bg-slate-800 px-4 py-3 text-xs text-slate-500">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-slate-400" />{" "}
                  Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleChat}
              className="border-t border-slate-800 px-4 py-3"
            >
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
    </div>
  );
}
