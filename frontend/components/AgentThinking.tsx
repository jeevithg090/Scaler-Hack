"use client";

const AGENTS = [
  { id: "orchestrator", name: "Orchestrator", icon: "⬡", color: "#6366f1" },
  { id: "extractor", name: "Extractor", icon: "◈", color: "#8b5cf6" },
  { id: "risk_hunter", name: "Risk Hunter", icon: "⚑", color: "#ef4444" },
  { id: "devils_advocate", name: "Devil's Advocate", icon: "⚖", color: "#f97316" },
  { id: "synthesis", name: "Synthesis", icon: "◎", color: "#c9a84c" },
  { id: "comparator", name: "Comparator", icon: "◫", color: "#22c55e" },
];

export function AgentThinking({
  active,
  completed,
}: {
  active: string | null;
  completed: Set<string>;
}) {
  const doneCount = AGENTS.filter((a) => completed.has(a.id)).length;
  const current = AGENTS.find((a) => a.id === active);
  const pct = Math.round((doneCount / AGENTS.length) * 100);
  return (
    <section
      aria-labelledby="pipeline-title"
      className="space-y-2 rounded-2xl border border-lex-border bg-lex-card/80 p-4 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="pipeline-title" className="eyebrow text-slate-300">
          Agent pipeline
        </h2>
        <span className="font-mono text-2xs text-slate-400">
          {doneCount}/{AGENTS.length} done
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-lex-accent to-indigo-300 transition-[width] duration-500"
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {current
          ? `${current.name} is analyzing.`
          : `${doneCount} of ${AGENTS.length} agents done.`}
      </p>
      <ol className="space-y-1">
        {AGENTS.map((agent) => {
          const done = completed.has(agent.id);
          const running = active === agent.id;
          return (
            <li
              key={agent.id}
              aria-current={running ? "step" : undefined}
              className={`relative flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300 ${
                done
                  ? "border-transparent bg-transparent"
                  : running
                    ? "border-slate-700 bg-slate-800/50"
                    : "border-transparent bg-transparent"
              }`}
            >
              {/* Shimmer overlay */}
              {running && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                  <div
                    className="absolute inset-0 animate-shimmer"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${agent.color}15, transparent)`,
                    }}
                  />
                </div>
              )}

              {/* Icon */}
              <div
                aria-hidden="true"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm transition-all"
                style={{
                  backgroundColor: done || running ? agent.color + "18" : "#0f172a",
                  color: done || running ? agent.color : "#64748b",
                }}
              >
                {agent.icon}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium transition-colors"
                  style={{
                    color: done ? agent.color : running ? "#f1f5f9" : "#94a3b8",
                  }}
                >
                  {agent.name}
                </p>
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                {running && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: agent.color }}
                    />
                    <span className="font-mono text-2xs font-medium" style={{ color: agent.color }}>
                      analyzing…
                    </span>
                  </span>
                )}
                {done && (
                  <span className="font-mono text-xs font-medium" style={{ color: agent.color }}>
                    ✓ done
                  </span>
                )}
                {!done && !running && (
                  <span className="font-mono text-2xs text-slate-400">pending</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
