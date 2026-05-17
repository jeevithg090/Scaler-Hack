"use client";

import { useState } from "react";

export function NegotiationScript({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-lex-accent/15 bg-lex-accent/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[9px] font-bold tracking-[1.5px] text-lex-accent">
          NEGOTIATION SCRIPT
        </p>
        <button
          onClick={handleCopy}
          className="rounded-md border border-lex-accent/20 bg-lex-accent/10 px-3 py-1 font-mono text-[10px] font-medium text-lex-accent transition-all hover:bg-lex-accent/20"
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-sm leading-relaxed text-indigo-200 italic">
        &ldquo;{script}&rdquo;
      </p>
    </div>
  );
}
