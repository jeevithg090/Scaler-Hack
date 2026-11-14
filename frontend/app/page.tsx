"use client";

import React, { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileText,
  GitCompare,
  Link2,
  Loader2,
  Sparkles,
  Type,
  UploadCloud,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { startAnalysis } from "@/lib/api";
import { SAMPLE_EMPLOYMENT } from "@/lib/samples";
import {
  MIN_TEXT_CHARS,
  formatBytes,
  validateFile,
  validateText,
  validateUrl,
} from "@/lib/validation";

type InputMode = "file" | "text" | "url";

const MODES: { id: InputMode; label: string; short: string; icon: typeof FileText }[] = [
  { id: "file", label: "Upload file", short: "File", icon: UploadCloud },
  { id: "text", label: "Paste text", short: "Text", icon: Type },
  { id: "url", label: "From URL", short: "URL", icon: Link2 },
];

const SCORE_BANDS = [
  { range: "0–19", label: "HOSTILE", color: "#f43f5e" },
  { range: "20–39", label: "PREDATORY", color: "#ef4444" },
  { range: "40–59", label: "HIGH RISK", color: "#fb923c" },
  { range: "60–79", label: "MODERATE", color: "#fbbf24" },
  { range: "80–89", label: "GOOD", color: "#4ade80" },
  { range: "90–100", label: "EXCELLENT", color: "#34d399" },
];

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
  const ids = { text: useId(), url: useId(), hint: useId(), a: useId(), b: useId() };
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareTouched, setCompareTouched] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fileError = file ? validateFile(file) : null;
  const fieldError =
    inputMode === "text"
      ? validateText(text)
      : inputMode === "url"
        ? validateUrl(url)
        : file
          ? fileError
          : "Choose a PDF, DOCX or TXT file first.";
  const showFieldError = Boolean(fieldError) && (touched || (inputMode === "file" && !!fileError));

  function selectMode(mode: InputMode) {
    setInputMode(mode);
    setTouched(false);
    setError(null);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setError(null);
    setInputMode("file");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (fieldError) return;
    setError(null);
    setLoading(true);
    try {
      const { analysis_id } = await startAnalysis(
        inputMode === "file" ? (file ?? undefined) : undefined,
        inputMode === "text" ? text.trim() : undefined,
        inputMode === "url" ? url.trim() : undefined,
      );
      router.push(`/analyze/${analysis_id}`);
    } catch (err) {
      setError(friendlyError(err, "We couldn't start the analysis."));
      setLoading(false);
    }
  }

  function loadSample() {
    setInputMode("text");
    setText(SAMPLE_EMPLOYMENT);
    setTouched(false);
    setError(null);
  }

  const compareErrA = validateText(compareA);
  const compareErrB = validateText(compareB);

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    setCompareTouched(true);
    if (compareErrA || compareErrB) return;
    setCompareError(null);
    setCompareLoading(true);
    try {
      const [first, second] = await Promise.all([
        startAnalysis(undefined, compareA.trim()),
        startAnalysis(undefined, compareB.trim()),
      ]);
      router.push(`/analyze/${first.analysis_id}?compare=${second.analysis_id}`);
    } catch (err) {
      setCompareError(friendlyError(err, "We couldn't start the comparison."));
      setCompareLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* ── Header ──────────────────────────────────── */}
      <header className="glass-strong fixed left-0 right-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 md:px-6">
          <Logo badge />
          <nav aria-label="Primary" className="flex items-center gap-1 md:gap-2">
            {[
              ["How it works", "#how-it-works"],
              ["What it catches", "#taxonomy"],
              ["LEXSCORE", "#lexscore"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="hidden min-h-[44px] items-center rounded-lg px-3 text-sm text-slate-300 transition-colors hover:text-white md:inline-flex"
              >
                {label}
              </a>
            ))}
            <a href="#analyze" className="btn-primary btn-sm ml-2">
              Analyze
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ── Hero ──────────────────────────────────── */}
        <section
          aria-labelledby="hero-title"
          className="relative flex flex-col items-center px-4 pb-20 pt-28 sm:px-6 md:pt-32"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-lex-accent/10 blur-[128px]" />
            <div className="absolute -right-32 top-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-[96px]" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-lex-red/30 bg-lex-red/10 px-4 py-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-lex-red"
              />
              <span className="eyebrow text-lex-red-soft">Adversarial AI contract review</span>
            </p>

            <h1
              id="hero-title"
              className="mb-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
            >
              Know what you&apos;re{" "}
              <span className="animate-gradient bg-gradient-to-r from-indigo-300 via-lex-accent to-indigo-300 bg-clip-text text-transparent">
                signing
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Six AI agents argue over every clause of your contract, one attacking and one
              defending, before a third settles it. You get a{" "}
              <strong className="font-semibold text-white">LEXSCORE</strong>, clause-by-clause
              verdicts and the exact words to negotiate with.
            </p>

            {/* ── Analyze card ─────────────────────── */}
            <div
              id="analyze"
              className="glass mx-auto max-w-2xl rounded-2xl p-1 text-left shadow-2xl shadow-black/40"
            >
              <form
                onSubmit={handleSubmit}
                noValidate
                aria-label="Analyze a contract"
                className="space-y-5 rounded-xl bg-lex-bg/80 p-4 sm:p-6"
              >
                <div
                  role="group"
                  aria-label="How do you want to provide the contract?"
                  className="grid grid-cols-3 gap-1 rounded-xl border border-lex-border bg-slate-900/40 p-1"
                >
                  {MODES.map(({ id, label, short, icon: Icon }) => {
                    const selected = inputMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectMode(id)}
                        className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-colors sm:text-sm ${
                          selected
                            ? "bg-indigo-600 text-white shadow"
                            : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                        }`}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span className="sm:hidden">{short}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {inputMode === "file" && (
                  <div>
                    <input
                      ref={fileRef}
                      id="contract-file"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="peer sr-only"
                      aria-describedby={ids.hint}
                      onChange={(e) => {
                        pickFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor="contract-file"
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        pickFile(e.dataTransfer.files?.[0]);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      className={`dropzone block cursor-pointer peer-focus-visible:border-lex-accent peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 ${dragActive ? "active" : ""} ${
                        fileError ? "!border-lex-red/60" : ""
                      }`}
                    >
                      <UploadCloud
                        aria-hidden="true"
                        className="mx-auto mb-3 h-9 w-9 text-lex-accent-soft"
                      />
                      <span className="block text-sm font-medium text-slate-100">
                        {dragActive ? "Drop to upload" : "Drop a file here or click to browse"}
                      </span>
                      <span id={ids.hint} className="mt-1 block text-xs text-slate-400">
                        PDF, DOCX or TXT · up to 10 MB
                      </span>
                    </label>
                    {file && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-lex-border bg-slate-900/50 px-4 py-3">
                        <FileText
                          aria-hidden="true"
                          className="h-5 w-5 shrink-0 text-lex-accent-soft"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
                          <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          aria-label={`Remove ${file.name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <X aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {inputMode === "text" && (
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <label htmlFor={ids.text} className="text-sm font-medium text-slate-200">
                        Contract text
                      </label>
                      <button
                        type="button"
                        onClick={loadSample}
                        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-lex-accent-soft hover:bg-lex-accent/10"
                      >
                        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                        Try a sample
                      </button>
                    </div>
                    <textarea
                      id={ids.text}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onBlur={() => text && setTouched(true)}
                      rows={7}
                      aria-invalid={showFieldError}
                      aria-describedby={`${ids.text}-msg`}
                      placeholder="Paste an employment contract, offer letter, NDA or terms of service…"
                      className={`field ${showFieldError ? "field-invalid" : ""}`}
                    />
                    <p className="text-right font-mono text-2xs text-slate-400" aria-hidden="true">
                      {text.trim().length.toLocaleString()} chars
                      {text.trim().length < MIN_TEXT_CHARS && ` · min ${MIN_TEXT_CHARS}`}
                    </p>
                  </div>
                )}

                {inputMode === "url" && (
                  <div className="space-y-2">
                    <label htmlFor={ids.url} className="text-sm font-medium text-slate-200">
                      Page address
                    </label>
                    <input
                      id={ids.url}
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onBlur={() => url && setTouched(true)}
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      aria-invalid={showFieldError}
                      aria-describedby={`${ids.url}-msg ${ids.url}-hint`}
                      placeholder="https://example.com/terms"
                      className={`field ${showFieldError ? "field-invalid" : ""}`}
                    />
                    <p id={`${ids.url}-hint`} className="text-xs text-slate-400">
                      Works best for public terms of service, privacy policies and online
                      agreements. Pages behind a login can&apos;t be fetched.
                    </p>
                  </div>
                )}

                <p
                  id={inputMode === "url" ? `${ids.url}-msg` : `${ids.text}-msg`}
                  aria-live="polite"
                  className={`flex min-h-[1.25rem] items-start gap-1.5 text-xs ${
                    showFieldError ? "text-lex-red-soft" : "sr-only"
                  }`}
                >
                  {showFieldError && (
                    <>
                      <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
                      {fieldError}
                    </>
                  )}
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="btn-primary min-h-[52px] w-full text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                      Starting analysis…
                    </>
                  ) : (
                    <>
                      {inputMode === "url" ? "Analyze page" : "Analyze contract"}
                      <ArrowRight aria-hidden="true" className="h-5 w-5" />
                    </>
                  )}
                </button>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-lex-red/30 bg-lex-red/10 p-3 text-sm text-lex-red-soft"
                  >
                    <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <p className="text-center text-xs text-slate-400">
                  No account needed. LEXGUARD is not legal advice.
                </p>
              </form>
            </div>

            <ul
              aria-label="Supported document types"
              className="mt-8 flex flex-wrap items-center justify-center gap-2"
            >
              {DOC_TYPES.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-lex-border bg-lex-card/40 px-3 py-1 text-xs text-slate-400"
                >
                  {t}
                </li>
              ))}
            </ul>

            {/* ── Compare offers ───────────────────── */}
            <form
              onSubmit={handleCompare}
              noValidate
              aria-labelledby="compare-title"
              className="card mx-auto mt-10 max-w-2xl p-4 text-left sm:p-6"
            >
              <div className="mb-4 flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"
                >
                  <GitCompare className="h-4 w-4" />
                </span>
                <div>
                  <h2 id="compare-title" className="text-base font-semibold text-white">
                    Compare two offers <span className="eyebrow ml-1 text-emerald-300">Beta</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    Paste both, and we&apos;ll analyze them in parallel and show the score
                    difference.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    id: ids.a,
                    label: "Offer A",
                    value: compareA,
                    set: setCompareA,
                    err: compareErrA,
                  },
                  {
                    id: ids.b,
                    label: "Offer B",
                    value: compareB,
                    set: setCompareB,
                    err: compareErrB,
                  },
                ].map((o) => {
                  const invalid = compareTouched && Boolean(o.err);
                  return (
                    <div key={o.label} className="space-y-1.5">
                      <label htmlFor={o.id} className="text-sm font-medium text-slate-200">
                        {o.label}
                      </label>
                      <textarea
                        id={o.id}
                        value={o.value}
                        onChange={(e) => o.set(e.target.value)}
                        rows={5}
                        aria-invalid={invalid}
                        aria-describedby={`${o.id}-msg`}
                        placeholder={`Paste the text of ${o.label}…`}
                        className={`field p-3 text-sm ${invalid ? "field-invalid" : ""}`}
                      />
                      <p
                        id={`${o.id}-msg`}
                        aria-live="polite"
                        className={`text-xs ${invalid ? "text-lex-red-soft" : "text-slate-400"}`}
                      >
                        {invalid ? o.err : `${o.value.trim().length.toLocaleString()} chars`}
                      </p>
                    </div>
                  );
                })}
              </div>
              <button
                type="submit"
                disabled={compareLoading}
                aria-busy={compareLoading}
                className="btn mt-4 w-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 sm:w-auto"
              >
                {compareLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Starting both analyses…
                  </>
                ) : (
                  "Compare offers"
                )}
              </button>
              {compareError && (
                <p role="alert" className="mt-3 text-sm text-lex-red-soft">
                  {compareError}
                </p>
              )}
            </form>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────── */}
        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="border-t border-lex-border/60 bg-lex-surface px-4 py-20 sm:px-6 md:py-24"
        >
          <div className="mx-auto max-w-content">
            <div className="mb-12 text-center">
              <p className="eyebrow mb-3 text-lex-accent-soft">The adversarial pipeline</p>
              <h2 id="how-title" className="text-3xl font-bold text-white md:text-4xl">
                Six agents. Zero blind spots.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-400">
                Instead of one model summarizing your contract, LEXGUARD makes agents argue with
                each other and only keeps the risks that survive.
              </p>
            </div>

            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AGENTS.map((agent, i) => (
                <li key={agent.name} className="glass rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                      style={{ backgroundColor: agent.color + "22", color: agent.color }}
                    >
                      {agent.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        <span className="font-mono text-slate-400">{i}.</span> {agent.name}
                      </h3>
                      <p className="text-sm text-slate-400">{agent.desc}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Detection taxonomy ────────────────────── */}
        <section
          id="taxonomy"
          aria-labelledby="taxonomy-title"
          className="px-4 py-20 sm:px-6 md:py-24"
        >
          <div className="mx-auto max-w-content">
            <div className="mb-12 text-center">
              <p className="eyebrow mb-3 text-lex-accent-soft">Detection taxonomy</p>
              <h2 id="taxonomy-title" className="text-3xl font-bold text-white md:text-4xl">
                What LEXGUARD catches
              </h2>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="glass rounded-xl p-6">
                  <div aria-hidden="true" className="mb-3 text-2xl" style={{ color: f.color }}>
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-100">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── LEXSCORE explainer ────────────────────── */}
        <section
          id="lexscore"
          aria-labelledby="lexscore-title"
          className="border-t border-lex-border/60 bg-lex-surface px-4 py-20 sm:px-6 md:py-24"
        >
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-3 text-lex-accent-soft">LEXSCORE</p>
            <h2 id="lexscore-title" className="mb-4 text-3xl font-bold text-white md:text-4xl">
              One number. The whole picture.
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-slate-400">
              Every contract starts at 100. Critical clauses cost 15 points, high-risk ones 8,
              medium 4, and each missing protection 5. Higher is safer.
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {SCORE_BANDS.map((s) => (
                <li
                  key={s.label}
                  className="rounded-xl border p-4"
                  style={{ borderColor: s.color + "40", backgroundColor: s.color + "0d" }}
                >
                  <div className="font-mono text-lg font-bold" style={{ color: s.color }}>
                    {s.range}
                  </div>
                  <div
                    className="mt-1 font-mono text-2xs font-bold tracking-wider"
                    style={{ color: s.color }}
                  >
                    {s.label}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────── */}
        <section aria-labelledby="cta-title" className="px-4 py-20 text-center sm:px-6 md:py-24">
          <div className="mx-auto max-w-lg">
            <h2 id="cta-title" className="mb-4 text-3xl font-bold text-white">
              Don&apos;t sign anything without running it first.
            </h2>
            <p className="mb-8 text-slate-400">
              Upload a PDF or DOCX, paste text, or point us at a public URL.
            </p>
            <a href="#analyze" className="btn-primary px-8 text-base">
              Analyze a contract
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </a>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {[
                "No account required",
                "PDF, DOCX, TXT or URL",
                "Downloadable negotiation pack",
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Check aria-hidden="true" className="h-4 w-4 text-lex-green" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-lex-border/60">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-4 py-6 text-center text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-left md:px-6">
          <p>
            <span className="font-mono font-bold tracking-widest text-slate-300">LEXGUARD</span> ·
            Built with Gemini for the H2S Build with AI hackathon
          </p>
          <p>Not legal advice. Consult a lawyer before signing anything important.</p>
        </div>
      </footer>
    </div>
  );
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    return "We couldn't reach the LEXGUARD server. Check your connection and that the backend is running, then try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
