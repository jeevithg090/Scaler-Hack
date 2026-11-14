import type { StreamEvent } from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);
const API = API_BASE;

export async function startAnalysis(
  file?: File,
  text?: string,
  url?: string,
): Promise<{ analysis_id: string }> {
  const form = new FormData();
  if (file) form.append("file", file);
  if (text) form.append("text", text);
  if (url) form.append("url", url);

  const res = await fetch(`${API}/api/analyze`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Analysis failed to start");
  }
  return res.json();
}

export function streamAnalysis(
  id: string,
  onEvent: (event: StreamEvent) => void,
  onDisconnect?: () => void,
): () => void {
  const es = new EventSource(`${API}/api/analyze/${id}/stream`);

  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      onEvent(data);
      if (data.type === "complete" || data.type === "error") {
        es.close();
      }
    } catch {
      /* ignore parse errors */
    }
  };

  es.onerror = () => {
    es.close();
    onDisconnect?.();
  };
  return () => es.close();
}

export async function getAnalysis(id: string) {
  const res = await fetch(`${API}/api/analyze/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

export async function sendChatMessage(analysisId: string, message: string): Promise<string> {
  const res = await fetch(`${API}/api/analyze/${analysisId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Chat failed");
  }
  const data = await res.json();
  return data.reply;
}

export async function downloadNegotiationPack(
  analysisId: string,
  format: "md" | "txt" = "md",
): Promise<Blob> {
  const res = await fetch(`${API}/api/analyze/${analysisId}/negotiation-pack?format=${format}`);
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || "Failed to generate negotiation pack");
  }
  return res.blob();
}
