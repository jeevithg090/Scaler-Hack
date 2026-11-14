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
  return (
    <div className="space-y-2 rounded-2xl border border-slate-800 bg-lex-card/80 p-6">
      <p className="mb-4 font-mono text-[10px] font-bold tracking-[2px] text-slate-500 uppercase">
        Adversarial Agent Pipeline
      </p>
      {AGENTS.map((agent) => {
        const done = completed.has(agent.id);
        const running = active === agent.id;
        return (
          <div
            key={agent.id}
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
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm transition-all"
              style={{
                backgroundColor: done || running ? agent.color + "18" : "#0f172a",
                color: done || running ? agent.color : "#334155",
              }}
            >
              {agent.icon}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium transition-colors"
                style={{
                  color: done ? agent.color : running ? "#e2e8f0" : "#475569",
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
                  <span
                    className="font-mono text-[10px] font-medium"
                    style={{ color: agent.color }}
                  >
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
                <span className="font-mono text-[10px] text-slate-700">pending</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
