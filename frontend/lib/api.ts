import type { StreamEvent } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function startAnalysis(
  file?: File,
  text?: string
): Promise<{ analysis_id: string }> {
  const form = new FormData();
  if (file) form.append("file", file);
  if (text) form.append("text", text);

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
  onEvent: (event: StreamEvent) => void
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

  es.onerror = () => es.close();
  return () => es.close();
}

export async function getAnalysis(id: string) {
  const res = await fetch(`${API}/api/analyze/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

export async function sendChatMessage(
  analysisId: string,
  message: string
): Promise<string> {
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
