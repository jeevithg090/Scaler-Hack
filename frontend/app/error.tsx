"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
    >
      <span
        aria-hidden="true"
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-lex-red/30 bg-lex-red/10 text-lex-red-soft"
      >
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400">
        An unexpected error occurred while rendering this page. Your analysis is not lost; try again
        or start over.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
      </div>
    </main>
  );
}
