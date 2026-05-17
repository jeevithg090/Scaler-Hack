"use client";

import { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  HOSTILE: "HOSTILE",
  PREDATORY: "PREDATORY",
  HIGH_RISK: "HIGH RISK",
  MODERATE: "MODERATE",
  FAIR: "FAIR",
  GOOD: "GOOD",
  EXCELLENT: "EXCELLENT",
};

function scoreColor(score: number): string {
  if (score <= 19) return "#7f1d1d";
  if (score <= 39) return "#ef4444";
  if (score <= 59) return "#f97316";
  if (score <= 79) return "#f59e0b";
  if (score <= 89) return "#22c55e";
  return "#34d399";
}

export function LexScore({ score, label }: { score: number; label: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let current = 0;
    const iv = setInterval(() => {
      current += 2;
      if (current >= score) {
        setDisplayed(score);
        clearInterval(iv);
      } else {
        setDisplayed(current);
      }
    }, 25);
    return () => clearInterval(iv);
  }, [score]);

  const color = scoreColor(displayed);
  const displayLabel = LABELS[label] || label.replace(/_/g, " ");

  // SVG arc gauge
  const r = 70;
  const cx = 100;
  const cy = 95;
  const startAngle = -210;
  const range = 240;
  const pct = displayed / 100;
  const angle = startAngle + pct * range;
  const rad = (a: number) => (a * Math.PI) / 180;

  const arcStart = {
    x: cx + r * Math.cos(rad(startAngle)),
    y: cy + r * Math.sin(rad(startAngle)),
  };
  const arcEnd = {
    x: cx + r * Math.cos(rad(angle)),
    y: cy + r * Math.sin(rad(angle)),
  };
  const arcFull = {
    x: cx + r * Math.cos(rad(startAngle + range)),
    y: cy + r * Math.sin(rad(startAngle + range)),
  };
  const largeArc = pct > 0.5 ? 1 : 0;

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-lex-card/80 p-8 animate-fade-in-up">
      <svg viewBox="0 0 200 130" width="220" height="143" className="mb-2">
        {/* Track */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 1 1 ${arcFull.x} ${arcFull.y}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {displayed > 0 && (
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
          />
        )}
        {/* Score number */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fill={color}
          fontSize="32"
          fontWeight="800"
          fontFamily="'JetBrains Mono', monospace"
        >
          {displayed}
        </text>
        {/* Label */}
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fill={color}
          fontSize="9"
          fontWeight="700"
          letterSpacing="2"
          fontFamily="'JetBrains Mono', monospace"
        >
          {displayLabel}
        </text>
        {/* Brand */}
        <text
          x={cx}
          y={cy + 32}
          textAnchor="middle"
          fill="#334155"
          fontSize="7"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="1.5"
        >
          LEXSCORE™
        </text>
      </svg>
      <p className="text-xs text-slate-500 mt-1">out of 100 · higher is safer</p>
    </div>
  );
}
