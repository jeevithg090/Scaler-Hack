import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center px-4 md:px-12">
        <Logo />
      </header>
      <main
        id="main"
        className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center"
      >
        <span
          aria-hidden="true"
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-lex-accent/30 bg-lex-accent/10 text-lex-accent-soft"
        >
          <FileQuestion className="h-7 w-7" />
        </span>
        <p className="eyebrow text-slate-400">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Analysis links only work
          while the server still holds that analysis.
        </p>
        <Link href="/" className="btn-primary mt-8">
          Analyze a contract
        </Link>
      </main>
    </div>
  );
}
