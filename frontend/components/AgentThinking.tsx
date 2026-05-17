"use client";

const AGENTS = [
  "orchestrator",
  "extractor",
  "risk_hunter",
  "devils_advocate",
  "synthesis",
  "comparator",
];

export function AgentThinking({
  active,
  completed,
}: {
  active: string | null;
  completed: Set<string>;
}) {
  return (
    <ul className="space-y-2 rounded-xl border border-slate-700 bg-lex-card p-4">
      {AGENTS.map((agent) => {
        const done = completed.has(agent);
        const running = active === agent;
        return (
          <li
            key={agent}
            className={`flex items-center gap-3 text-sm ${
              done ? "text-lex-green" : running ? "text-lex-accent" : "text-slate-500"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            <span className="font-mono">{agent}</span>
            {running && <span className="animate-pulse">running…</span>}
            {done && <span>✓</span>}
          </li>
        );
      })}
    </ul>
  );
}
