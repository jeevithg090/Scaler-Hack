"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startAnalysis } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { analysis_id } = await startAnalysis(undefined, text);
      router.push(`/analyze/${analysis_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      const { analysis_id } = await startAnalysis(file);
      router.push(`/analyze/${analysis_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          LEX<span className="text-lex-accent">GUARD</span>
        </h1>
        <p className="mt-3 text-slate-400">
          Adversarial AI that fights for you before you sign
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <label className="block">
          <span className="text-sm text-slate-400">Paste contract text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Paste employment contract, ToS, NDA, or offer letter…"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-lex-card p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-lex-accent focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading || text.length < 50}
            className="rounded-lg bg-lex-accent px-6 py-3 font-semibold text-white disabled:opacity-40"
          >
            {loading ? "Starting…" : "Analyze"}
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-600 px-6 py-3 text-sm hover:bg-slate-800">
            Upload PDF/DOCX/TXT
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        <p className="w-full text-xs text-slate-500">
          Demo: paste content from samples/demo-employment.txt
        </p>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-950/50 p-3 text-sm text-lex-red">{error}</p>
      )}
    </main>
  );
}
