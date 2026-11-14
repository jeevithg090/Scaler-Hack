import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-xs tracking-[3px] text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Page not found</h1>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-lex-accent px-6 py-2 text-sm font-medium text-white"
      >
        Back to LEXGUARD
      </Link>
    </main>
  );
}
