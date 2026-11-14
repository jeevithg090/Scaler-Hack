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
  AlertTriangle,
  Check,
  Download,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  downloadNegotiationPack,
  getAnalysis,
  getHealth,
  sendChatMessage,
  streamAnalysis,
} from "@/lib/api";
import {
  filterAndSortClauses,
  projectScore,
  riskyClauses as selectRiskyClauses,
  scoreLabel,
} from "@/lib/scoring";
import type { LexGuardAnalysis, StreamEvent } from "@/lib/types";

const POLL_INTERVAL_MS = 2500;

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
  const [notice, setNotice] = useState<string | null>(null);
  const [compareFailed, setCompareFailed] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [simResolved, setSimResolved] = useState<Set<string>>(new Set());

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatToggleRef = useRef<HTMLButtonElement>(null);

  // Only show voice controls when the backend has ElevenLabs configured.
  useEffect(() => {
    getHealth()
      .then((h) => setVoiceEnabled(Boolean(h.environment?.elevenlabs)))
      .catch(() => setVoiceEnabled(false));
  }, []);

  // Chat panel: focus the input on open, close on Escape and return focus to the toggle.
  useEffect(() => {
    if (!chatOpen) return;
    chatInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setChatOpen(false);
        chatToggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const applySnapshot = (data: LexGuardAnalysis): boolean => {
      if (data.status === "complete" && data.lexscore !== undefined) {
        setResult(data);
        setActive(null);
        return true;
      }
      if (data.status === "error") {
        setError("Analysis failed. Please try again.");
        return true;
      }
      return false;
    };

    // Fallback when the event stream drops: poll the snapshot endpoint until it settles.
    const poll = () => {
      getAnalysis(id)
        .then((data) => {
          if (cancelled || applySnapshot(data)) return;
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        })
        .catch(() => {
          if (!cancelled) setError("Analysis not found or the server is unreachable.");
        });
    };

    const close = streamAnalysis(
      id,
      (ev: StreamEvent) => {
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
      },
      () => {
        if (!cancelled) poll();
      },
    );

    getAnalysis(id)
      .then((data) => {
        if (!cancelled) applySnapshot(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      close();
    };
  }, [id]);

  // The comparison analysis runs concurrently, so poll until it finishes.
  useEffect(() => {
    if (!compareId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      getAnalysis(compareId)
        .then((data) => {
          if (cancelled) return;
          if (data.status === "complete" && data.lexscore !== undefined) {
            setCompareResult(data as LexGuardAnalysis);
          } else if (data.status === "error") {
            setCompareFailed(true);
          } else {
            timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        })
        .catch(() => {
          if (!cancelled) setCompareFailed(true);
        });
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [compareId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const riskyClauses = useMemo(() => selectRiskyClauses(result?.clauses || []), [result]);

  const projectedScore = useMemo(
    () => (result ? projectScore(result.lexscore, result.clauses, simResolved) : 0),
    [result, simResolved],
  );

  const projectedLabel = useMemo(() => scoreLabel(projectedScore), [projectedScore]);

  const filteredClauses = useMemo(
    () => filterAndSortClauses(result?.clauses || [], filter),
    [result, filter],
  );

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
      setNotice(err instanceof Error ? err.message : "Could not download the negotiation pack.");
    } finally {
      setPackLoading(null);
    }
  };

  const copyShareLink = async () => {
    const link = typeof window !== "undefined" ? window.location.href : "";
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setNotice("Couldn't access the clipboard. Copy the address from your browser bar instead.");
      return;
    }
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

  const planTone =
    result?.action_plan?.recommendation === "WALK_AWAY"
      ? "border-lex-red/40 bg-red-950/30 text-red-100"
      : result?.action_plan?.recommendation === "SIGN"
        ? "border-lex-green/40 bg-emerald-950/30 text-emerald-100"
        : "border-amber-500/40 bg-amber-950/30 text-amber-100";

  const filterCounts: Record<Filter, number> = {
    ALL: result?.clauses.length ?? 0,
    RED: result?.summary.red_clauses ?? 0,
    AMBER: result?.summary.amber_clauses ?? 0,
    GREEN: result?.summary.green_clauses ?? 0,
  };

  return (
    <div className="min-h-screen">
      <header className="glass-strong fixed left-0 right-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-2 px-4 md:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            {result && (
              <button
                ref={chatToggleRef}
                type="button"
                onClick={() => setChatOpen(!chatOpen)}
                aria-expanded={chatOpen}
                aria-controls="contract-chat"
                className="btn-secondary btn-sm"
              >
                <MessageSquare aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Ask the contract</span>
                <span className="sm:hidden">Ask</span>
              </button>
            )}
            <Link href="/" className="btn-primary btn-sm">
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">New analysis</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-content px-4 pb-24 pt-24 md:px-6">
        {!result && !error && (
          <div className="mt-4 animate-fade-in-up" aria-busy="true">
            <p className="eyebrow mb-2 text-lex-accent-soft">Analysis in progress</p>
            <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
              Analyzing your contract…
            </h1>
            <p className="mb-8 text-sm text-slate-400">
              This usually takes under a minute. You can keep this tab open; results appear
              automatically.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <AgentThinking active={active} completed={completed} />
              <div aria-hidden="true" className="card space-y-4 p-6">
                <div className="h-4 w-1/3 animate-pulse rounded bg-slate-800" />
                <div className="mx-auto my-6 h-32 w-32 animate-pulse rounded-full border-[10px] border-slate-800" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-800" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
              </div>
            </div>
            <p className="mt-6 font-mono text-2xs text-slate-400">Analysis ID: {id}</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-auto mt-8 max-w-lg animate-fade-in-up rounded-2xl border border-lex-red/30 bg-lex-red/10 p-8 text-center"
          >
            <span
              aria-hidden="true"
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-lex-red/15 text-lex-red-soft"
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-semibold text-white">
              We couldn&apos;t finish this analysis
            </h1>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            <p className="mt-2 text-sm text-slate-400">
              Analyses are kept on the server for a limited time, so older links can expire.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
              <Link href="/" className="btn-primary">
                Start a new analysis
              </Link>
            </div>
          </div>
        )}

        {notice && (
          <div
            role="alert"
            className="fixed bottom-4 left-4 right-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-xl border border-lex-red/40 bg-lex-card p-4 text-sm text-lex-red-soft shadow-2xl"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="-m-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-6 animate-fade-in-up">
            <div>
              <p className="eyebrow mb-1 text-lex-accent-soft">Analysis report</p>
              <h1 className="text-2xl font-bold capitalize text-white sm:text-3xl">
                {(result.doc_type || "Contract").replace(/_/g, " ")}
              </h1>
              {result.weaker_party && (
                <p className="mt-1 text-sm text-slate-400">
                  Reviewed from the{" "}
                  <span className="text-slate-200">{result.weaker_party.replace(/_/g, " ")}</span>
                  &apos;s point of view
                </p>
              )}
            </div>

            <section aria-labelledby="plan-title" className={`rounded-2xl border p-5 ${planTone}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 id="plan-title" className="eyebrow">
                  Action plan
                </h2>
                <span className="rounded-md border border-white/20 bg-black/25 px-2 py-0.5 font-mono text-2xs font-bold">
                  {result.action_plan?.recommendation?.replace(/_/g, " ")}
                </span>
                <span className="rounded-md border border-white/20 bg-black/25 px-2 py-0.5 font-mono text-2xs">
                  URGENCY {result.action_plan?.urgency}
                </span>
              </div>
              <p className="text-base font-medium">{result.action_plan?.rationale}</p>
              <p className="mt-2 text-sm opacity-90">
                If ignored: {result.action_plan?.downside_if_ignored}
              </p>
              <ol className="mt-4 flex flex-wrap gap-2">
                {(result.action_plan?.next_steps || []).map((step, i) => (
                  <li key={`${i}-${step}`} className="rounded-lg bg-black/25 px-3 py-1.5 text-sm">
                    <span className="font-mono opacity-80">{i + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
              <div className="space-y-4">
                <LexScore score={result.lexscore} label={result.lexscore_label} />
                {riskyClauses.length > 0 && (
                  <fieldset className="card p-4">
                    <legend className="sr-only">Score simulator</legend>
                    <p aria-hidden="true" className="eyebrow mb-2 text-slate-300">
                      Score simulator
                    </p>
                    <p className="text-sm text-slate-400">
                      Tick the clauses you expect to win in negotiation:
                    </p>
                    <p className="mt-2 flex items-end gap-2" aria-live="polite">
                      <span className="font-mono text-3xl font-bold text-lex-green">
                        {projectedScore}
                      </span>
                      <span className="pb-1 text-sm text-slate-300">
                        projected ({projectedLabel.replace(/_/g, " ").toLowerCase()})
                      </span>
                    </p>
                    <div className="mt-3 space-y-2">
                      {riskyClauses.slice(0, 6).map((clause) => (
                        <label
                          key={clause.clause_id}
                          className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-lex-border bg-slate-900/40 px-3 py-2 transition-colors hover:border-slate-600"
                        >
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
                            className="h-4 w-4 shrink-0 accent-lex-accent"
                          />
                          <span className="text-sm text-slate-200">
                            <span className="font-mono text-slate-400">{clause.clause_id}</span>{" "}
                            {clause.clause_type.replace(/_/g, " ")}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>

              <div className="min-w-0 space-y-4">
                <section aria-labelledby="summary-title" className="card p-4 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 id="summary-title" className="text-base font-semibold text-white">
                      Document summary
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {voiceEnabled && (
                        <AudioPlayer
                          endpoint={`/api/analyze/${id}/voice/briefing`}
                          buttonText="Audio briefing"
                          size="sm"
                        />
                      )}
                      <button
                        type="button"
                        onClick={copyShareLink}
                        className="btn-secondary btn-sm"
                      >
                        {linkCopied ? (
                          <Check aria-hidden="true" className="h-4 w-4 text-lex-green" />
                        ) : (
                          <Link2 aria-hidden="true" className="h-4 w-4" />
                        )}
                        <span aria-live="polite">{linkCopied ? "Link copied" : "Copy link"}</span>
                      </button>
                      {(["md", "txt"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => handlePackDownload(fmt)}
                          disabled={packLoading !== null}
                          aria-busy={packLoading === fmt}
                          className="btn-secondary btn-sm"
                        >
                          {packLoading === fmt ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download aria-hidden="true" className="h-4 w-4" />
                          )}
                          Pack .{fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Clauses", count: result.summary.total_clauses, color: "#a5b4fc" },
                      { label: "Critical", count: result.summary.red_clauses, color: "#f87171" },
                      { label: "Warning", count: result.summary.amber_clauses, color: "#fbbf24" },
                      { label: "Clear", count: result.summary.green_clauses, color: "#4ade80" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="flex flex-col-reverse rounded-xl border border-lex-border bg-slate-900/50 p-3 text-center"
                      >
                        <dt className="mt-0.5 text-xs text-slate-400">{s.label}</dt>
                        <dd className="font-mono text-2xl font-bold" style={{ color: s.color }}>
                          {s.count}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-lex-border bg-slate-900/40 p-4">
                      <h3 className="eyebrow mb-2 text-slate-300">Risk taxonomy</h3>
                      <dl className="space-y-1 text-sm text-slate-300">
                        {Object.entries(result.risk_taxonomy_counts || {}).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <dt className="capitalize">{k.replace(/_/g, " ").toLowerCase()}</dt>
                            <dd className="font-mono">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
                      <h3 className="eyebrow mb-2 text-indigo-300">Why adversarial helps</h3>
                      <dl className="space-y-1 text-sm text-indigo-100">
                        {[
                          [
                            "Disagreements surfaced",
                            result.adversarial_metrics?.disagreements_count ?? 0,
                          ],
                          [
                            "Defenses overturned",
                            result.adversarial_metrics?.defenses_overturned ?? 0,
                          ],
                          [
                            "Defensible clauses kept",
                            result.adversarial_metrics?.defensible_clauses ?? 0,
                          ],
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <dt>{k}</dt>
                            <dd className="font-mono">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>

                  {result.summary.critical_issues?.length > 0 && (
                    <div className="mt-4 rounded-xl border border-lex-red/30 bg-red-950/20 p-4">
                      <h3 className="eyebrow mb-2 flex items-center gap-1.5 text-lex-red-soft">
                        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                        Top critical issues
                      </h3>
                      <ul className="space-y-1.5">
                        {result.summary.critical_issues.map((issue: string, i: number) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm leading-relaxed text-red-200"
                          >
                            <span aria-hidden="true" className="mt-0.5 text-lex-red">
                              ▸
                            </span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                {result.document_benchmark?.industry_comparison && (
                  <section aria-label="Industry benchmark" className="card p-4 sm:p-6">
                    <div className="mb-2 flex items-baseline gap-3">
                      <span className="font-mono text-3xl font-bold text-lex-red-soft">
                        {result.document_benchmark.percentile}th
                      </span>
                      <span className="text-sm text-slate-400">risk percentile</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {result.document_benchmark.industry_comparison}
                    </p>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${result.document_benchmark.percentile}%`,
                          background: "linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)",
                        }}
                      />
                    </div>
                  </section>
                )}

                {result.raw_meta?.orchestrator?.jurisdiction_hints?.length ? (
                  <p className="rounded-xl border border-lex-border bg-slate-900/30 p-4 text-sm text-slate-300">
                    Jurisdiction hints detected:{" "}
                    {result.raw_meta.orchestrator.jurisdiction_hints.join(", ")}. Enforceability
                    varies by region.
                  </p>
                ) : null}

                {checklist.length > 0 && (
                  <section
                    aria-labelledby="checklist-title"
                    className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4"
                  >
                    <h2 id="checklist-title" className="eyebrow mb-3 text-emerald-300">
                      Before you sign, ask for
                    </h2>
                    <ul className="space-y-2">
                      {checklist.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg border border-emerald-500/20 bg-black/20 px-3 py-2 text-sm text-emerald-50"
                        >
                          {item.item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>

            {compareId && (
              <section aria-labelledby="compare-title" className="card p-5" aria-live="polite">
                <h2 id="compare-title" className="eyebrow mb-3 text-slate-300">
                  Offer comparison (beta)
                </h2>
                {compareResult ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-lex-border bg-black/20 p-4">
                        <p className="text-sm text-slate-400">Offer A (this report)</p>
                        <p className="font-mono text-3xl font-bold text-lex-accent-soft">
                          {result.lexscore}
                        </p>
                      </div>
                      <div className="rounded-xl border border-lex-border bg-black/20 p-4">
                        <p className="text-sm text-slate-400">Offer B</p>
                        <p className="font-mono text-3xl font-bold text-emerald-300">
                          {compareResult.lexscore}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                      {result.lexscore === compareResult.lexscore
                        ? "Both offers score the same."
                        : `Offer ${result.lexscore > compareResult.lexscore ? "A" : "B"} is safer by ${Math.abs(
                            result.lexscore - compareResult.lexscore,
                          )} points.`}{" "}
                      Higher scores are safer.
                    </p>
                  </>
                ) : compareFailed ? (
                  <p className="text-sm text-lex-red-soft">
                    The second analysis failed, so there&apos;s nothing to compare against.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-slate-300">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Still analyzing offer B…
                  </p>
                )}
              </section>
            )}

            {result.missing_protections?.length > 0 && (
              <section
                aria-labelledby="missing-title"
                className="rounded-2xl border border-indigo-500/25 bg-indigo-950/20 p-5 sm:p-6"
              >
                <h2 id="missing-title" className="eyebrow mb-3 text-lex-accent-soft">
                  Missing protections
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {result.missing_protections.map((p: string, i: number) => (
                    <li
                      key={i}
                      className="rounded-lg border border-lex-accent/25 bg-lex-accent/10 px-3 py-1.5 text-sm text-indigo-200"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="clauses-title" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="clauses-title" className="text-lg font-semibold text-white">
                  Clause breakdown
                </h2>
                <div
                  role="group"
                  aria-label="Filter clauses by verdict"
                  className="flex gap-1 rounded-xl border border-lex-border bg-lex-card/50 p-1"
                >
                  {(["ALL", "RED", "AMBER", "GREEN"] as Filter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      aria-pressed={filter === f}
                      aria-label={`Show ${f === "ALL" ? "all" : f.toLowerCase()} clauses (${filterCounts[f]})`}
                      className={`min-h-[40px] rounded-lg px-3 font-mono text-2xs font-bold tracking-wider transition-colors ${
                        filter === f
                          ? f === "RED"
                            ? "bg-lex-red/20 text-red-300"
                            : f === "AMBER"
                              ? "bg-lex-amber/20 text-amber-300"
                              : f === "GREEN"
                                ? "bg-lex-green/20 text-green-300"
                                : "bg-lex-accent/25 text-indigo-200"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {f} <span className="opacity-70">{filterCounts[f]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="stagger-children space-y-3">
                {filteredClauses.map((c) => (
                  <ClauseCard
                    key={c.clause_id}
                    clause={c}
                    analysisId={id}
                    voiceEnabled={voiceEnabled}
                  />
                ))}
              </div>
              {filteredClauses.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center">
                  <p className="text-sm text-slate-300">
                    No {filter.toLowerCase()} clauses in this document.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilter("ALL")}
                    className="mt-3 text-sm font-medium text-lex-accent-soft underline-offset-4 hover:underline"
                  >
                    Show all clauses
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {chatOpen && result && (
        <div
          id="contract-chat"
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-title"
          className="fixed bottom-0 right-0 z-50 w-full animate-fade-in-up sm:bottom-6 sm:right-6 sm:max-w-md"
        >
          <div className="flex h-[min(32rem,85dvh)] flex-col rounded-t-2xl border border-slate-700 bg-lex-bg shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-lex-border px-5 py-3">
              <div>
                <h2 id="chat-title" className="text-sm font-semibold text-white">
                  Ask about this contract
                </h2>
                <p className="text-xs text-slate-400">
                  LEXSCORE {result.lexscore} · {result.summary.total_clauses} clauses
                </p>
              </div>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => {
                  setChatOpen(false);
                  chatToggleRef.current?.focus();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div
              className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
              role="log"
              aria-live="polite"
              aria-label="Conversation"
            >
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">Try asking:</p>
                  {[
                    "What is the single most dangerous clause?",
                    "Which 2 edits will raise my score fastest?",
                    "Draft one email to negotiate all red clauses.",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setChatInput(q);
                        chatInputRef.current?.focus();
                      }}
                      className="block min-h-[44px] w-full rounded-lg border border-lex-border px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:border-lex-accent/40 hover:bg-lex-accent/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "ml-8 bg-lex-accent/20 text-indigo-100"
                      : "mr-8 bg-slate-800 text-slate-200"
                  }`}
                >
                  <span className="sr-only">{msg.role === "user" ? "You: " : "LEXGUARD: "}</span>
                  {formatMessage(msg.content)}
                </div>
              ))}
              {chatLoading && (
                <div className="mr-8 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-300">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChat} className="border-t border-lex-border px-4 py-3">
              <div className="flex gap-2">
                <label htmlFor="chat-input" className="sr-only">
                  Ask a question about this contract
                </label>
                <input
                  id="chat-input"
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={2000}
                  autoComplete="off"
                  placeholder="Ask about this contract…"
                  className="field min-h-[44px] flex-1 px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  aria-label="Send question"
                  className="btn-primary min-h-[44px] w-12 px-0"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {result && process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID && (
        <VoiceWidget agentId={process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID} analysisId={id} />
      )}
    </div>
  );
}
