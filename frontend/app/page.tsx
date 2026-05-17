"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startAnalysis } from "@/lib/api";

const FEATURES = [
  {
    icon: "⚑",
    title: "Exploitative Clauses",
    desc: "Unilateral modification, asymmetric termination, one-sided indemnification",
    color: "#ef4444",
  },
  {
    icon: "◎",
    title: "Hidden Liabilities",
    desc: "Buried definitions, IP assignments via reference, auto-renewal traps",
    color: "#f97316",
  },
  {
    icon: "◈",
    title: "Legal Ambiguities",
    desc: "Undefined 'reasonable efforts', vague geographic scope, unclear timelines",
    color: "#f59e0b",
  },
  {
    icon: "⬡",
    title: "Missing Protections",
    desc: "No severance clause, missing IP carve-out, no data deletion rights",
    color: "#6366f1",
  },
];

const AGENTS = [
  { name: "Orchestrator", icon: "⬡", desc: "Routes & classifies", color: "#6366f1" },
  { name: "Extractor", icon: "◈", desc: "Parses every clause", color: "#8b5cf6" },
  { name: "Risk Hunter", icon: "⚑", desc: "Finds all exploits", color: "#ef4444" },
  { name: "Devil's Advocate", icon: "⚖", desc: "Steelmans the defense", color: "#f97316" },
  { name: "Synthesis", icon: "◎", desc: "Arbitrates the verdict", color: "#c9a84c" },
  { name: "Comparator", icon: "◫", desc: "Industry benchmarks", color: "#22c55e" },
];

const DOC_TYPES = [
  "Employment Contracts",
  "Offer Letters",
  "NDAs",
  "Service Agreements",
  "Terms of Service",
  "Privacy Policies",
  "Lease Agreements",
  "Freelance Contracts",
];

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.length < 50) return;
    setError(null);
    setLoading(true);
    try {
      const { analysis_id } = await startAnalysis(undefined, text);
      router.push(`/analyze/${analysis_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setLoading(true);
    try {
      const { analysis_id } = await startAnalysis(file);
      router.push(`/analyze/${analysis_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ── Nav ─────────────────────────────────────── */}
      <nav className="glass-strong fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lex-accent to-indigo-400">
            <span className="text-xs font-bold text-white">⚖</span>
          </div>
          <span className="font-mono text-sm font-bold tracking-[3px] text-slate-200">
            LEXGUARD
          </span>
          <span className="rounded bg-lex-accent/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-lex-accent">
            AI BETA
          </span>
        </div>
        <div className="hidden gap-8 md:flex">
          {["Platform", "How It Works", "Docs"].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/ /g, "-")}`}
              className="text-sm text-slate-500 transition-colors hover:text-lex-accent"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-lex-accent/5 blur-[128px]" />
          <div className="absolute -right-32 top-1/3 h-72 w-72 rounded-full bg-indigo-500/5 blur-[96px]" />
          <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-lex-red/3 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-lex-red/20 bg-lex-red/5 px-4 py-1.5">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-lex-red" />
            <span className="font-mono text-[10px] font-bold tracking-[2px] text-lex-red">
              ADVERSARIAL AI CONTRACT INTELLIGENCE
            </span>
          </div>

          <h1 className="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
            Know what you're
            <br />
            <span className="bg-gradient-to-r from-lex-accent via-indigo-400 to-lex-accent bg-clip-text text-transparent animate-gradient">
              signing
            </span>
          </h1>

          <p className="mx-auto mb-12 max-w-2xl text-lg text-slate-400 leading-relaxed">
            Six adversarial AI agents fight over every clause in your contract.
            They argue both sides. Then give you a{" "}
            <span className="font-semibold text-white">LEXSCORE</span>,{" "}
            <span className="font-semibold text-lex-red">risk verdicts</span>,
            and the exact{" "}
            <span className="font-semibold text-lex-accent">
              words to fight back
            </span>
            .
          </p>

          {/* Stats */}
          <div className="mx-auto mb-14 flex max-w-md justify-center gap-12">
            {[
              ["6", "AI Agents"],
              ["<45s", "Analysis"],
              ["100%", "Free"],
            ].map(([n, l]) => (
              <div key={l} className="text-center">
                <div className="font-mono text-2xl font-bold text-lex-accent">
                  {n}
                </div>
                <div className="mt-1 text-xs text-slate-500">{l}</div>
              </div>
            ))}
          </div>

          {/* ── Upload card ──────────────────────────── */}
          <div
            id="platform"
            className="glass mx-auto max-w-2xl rounded-2xl p-1"
          >
            <div className="rounded-xl bg-lex-bg/80 p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Drop zone */}
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={() => setDragActive(false)}
                  onClick={() => fileRef.current?.click()}
                  className={`dropzone cursor-pointer ${dragActive ? "active" : ""}`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <div className="mb-3 text-3xl">📄</div>
                  {fileName ? (
                    <p className="font-mono text-sm text-lex-accent">
                      {fileName}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-300">
                        Drop a PDF, DOCX, or TXT file here
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        or click to browse · max 10MB
                      </p>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs font-medium text-slate-600">
                    OR PASTE TEXT
                  </span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Textarea */}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Paste your employment contract, ToS, NDA, or offer letter here…"
                  className="w-full rounded-xl border border-slate-800 bg-lex-card/50 p-4 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-lex-accent/50 focus:outline-none focus:ring-1 focus:ring-lex-accent/20"
                />

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || text.length < 50}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-lex-accent to-indigo-500 py-4 text-sm font-bold tracking-wide text-white shadow-lg shadow-lex-accent/20 transition-all disabled:opacity-30 disabled:shadow-none hover:shadow-lex-accent/30"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Analyzing…
                    </span>
                  ) : (
                    "Analyze Contract →"
                  )}
                </button>

                {text.length > 0 && text.length < 50 && (
                  <p className="text-center text-xs text-slate-600">
                    {50 - text.length} more characters needed
                  </p>
                )}
              </form>

              {error && (
                <div className="mt-4 rounded-lg border border-lex-red/20 bg-lex-red/5 p-3 text-center text-sm text-lex-red">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Supported doc types */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {DOC_TYPES.map((t) => (
              <span
                key={t}
                className="rounded-full border border-slate-800 bg-lex-card/40 px-3 py-1 text-[10px] font-medium text-slate-500"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────── */}
      <section
        id="how-it-works"
        className="border-t border-slate-800/50 bg-[#08101c] px-6 py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-[10px] font-bold tracking-[3px] text-lex-accent">
              THE ADVERSARIAL PIPELINE
            </p>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Six agents. Zero blind spots.
            </h2>
            <p className="mt-4 text-slate-500">
              While every other tool has one AI summarize your contract, we pit
              agents against each other.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent, i) => (
              <div
                key={agent.name}
                className="glass group rounded-xl p-6 transition-all duration-300 hover:border-slate-600"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: agent.color + "18", color: agent.color }}
                  >
                    {agent.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Agent {i}: {agent.name}
                    </p>
                    <p
                      className="font-mono text-[10px]"
                      style={{ color: agent.color }}
                    >
                      {agent.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Detection taxonomy ──────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-[10px] font-bold tracking-[3px] text-lex-accent">
              DETECTION TAXONOMY
            </p>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              What LEXGUARD catches
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass rounded-xl p-6 transition-all duration-300 hover:border-slate-600"
              >
                <div
                  className="mb-3 text-2xl"
                  style={{ color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="mb-2 text-sm font-semibold text-slate-200">
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LEXSCORE explainer ──────────────────────── */}
      <section className="border-t border-slate-800/50 bg-[#08101c] px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 font-mono text-[10px] font-bold tracking-[3px] text-lex-accent">
            LEXSCORE™
          </p>
          <h2 className="mb-10 text-3xl font-bold text-white md:text-4xl">
            One number. The whole truth.
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { range: "0–19", label: "HOSTILE", color: "#7f1d1d", border: "#991b1b" },
              { range: "20–39", label: "PREDATORY", color: "#ef4444", border: "#ef4444" },
              { range: "40–59", label: "HIGH RISK", color: "#f97316", border: "#f97316" },
              { range: "60–79", label: "MODERATE", color: "#f59e0b", border: "#f59e0b" },
              { range: "80–89", label: "GOOD", color: "#22c55e", border: "#22c55e" },
              { range: "90–100", label: "EXCELLENT", color: "#34d399", border: "#34d399" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border p-4"
                style={{
                  borderColor: s.border + "33",
                  backgroundColor: s.color + "08",
                }}
              >
                <div
                  className="font-mono text-lg font-bold"
                  style={{ color: s.color }}
                >
                  {s.range}
                </div>
                <div
                  className="mt-1 font-mono text-[8px] font-bold tracking-wider"
                  style={{ color: s.color }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-lex-accent/20 bg-gradient-to-br from-lex-accent/10 to-lex-red/10 text-2xl">
            ⚖
          </div>
          <h2 className="mb-4 text-3xl font-bold text-white">
            Don't sign anything
            <br />
            without running it.
          </h2>
          <p className="mb-8 text-slate-500">
            Upload any PDF, DOCX, or paste text. Full adversarial analysis in
            under 45 seconds.
          </p>
          <button
            onClick={() =>
              document.getElementById("platform")?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded-xl bg-gradient-to-r from-lex-accent to-indigo-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-lex-accent/20 transition-all hover:shadow-lex-accent/30"
          >
            Analyze Your Contract Free →
          </button>
          <div className="mt-6 flex flex-wrap justify-center gap-6">
            {["No account required", "Results in 45s", "Files auto-deleted 24h"].map(
              (t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 font-mono text-xs text-slate-600"
                >
                  <span className="text-lex-green">✓</span> {t}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/50 px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold tracking-widest text-slate-600">
            LEXGUARD
          </span>
          <span className="text-xs text-slate-800">
            — AI Rights & Contract Intelligence
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-lex-green" />
          <span className="font-mono text-[10px] text-slate-600">
            All systems operational
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-800">
          Built with Gemini · GCP · H2S Hackathon 2025
        </span>
      </footer>
    </div>
  );
}
