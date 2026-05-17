"use client";

import { useEffect, useRef } from "react";

export function VoiceWidget({
  agentId,
  analysisId,
}: {
  agentId: string;
  analysisId: string;
}) {
  const widgetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Add the script
    const script = document.createElement("script");
    script.src = "https://elevenlabs.io/convai-widget/index.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 
        The elevenlabs-convai element expects agent-id. 
        We pass analysis_id via dynamic variables so the custom LLM knows the context.
      */}
      <elevenlabs-convai
        ref={widgetRef}
        agent-id={agentId}
        action-text="Talk to LEXGUARD"
        style={{
          "--bg-color": "rgb(20, 20, 20)",
          "--text-color": "white",
        } as React.CSSProperties}
        dynamic-variables={JSON.stringify({ UUID: analysisId })}
      ></elevenlabs-convai>
    </div>
  );
}

// Ensure TypeScript knows about the custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "agent-id": string;
          "action-text"?: string;
          "dynamic-variables"?: string;
        },
        HTMLElement
      >;
    }
  }
}
