import Link from "next/link";
import { Scale } from "lucide-react";

/** Brand mark used in every page header. Links home. */
export function Logo({ badge = false }: { badge?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="LEXGUARD home"
      className="flex min-h-[44px] items-center gap-3 rounded-lg"
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lex-accent to-indigo-400 text-white"
      >
        <Scale className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className="font-mono text-sm font-bold tracking-[3px] text-slate-100">LEXGUARD</span>
      {badge && (
        <span className="hidden rounded bg-lex-accent/15 px-2 py-0.5 font-mono text-2xs font-bold tracking-widest text-lex-accent-soft sm:inline">
          BETA
        </span>
      )}
    </Link>
  );
}
