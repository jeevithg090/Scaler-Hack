import { ImageResponse } from "next/og";

export const alt = "LEXGUARD: adversarial multi-agent contract analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #0a0f1a 0%, #111a33 60%, #1e1b4b 100%)",
        color: "#f1f5f9",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: 8, color: "#a5b4fc", fontWeight: 700 }}>
        LEXGUARD
      </div>
      <div style={{ fontSize: 76, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>
        Know what you&apos;re signing.
      </div>
      <div style={{ fontSize: 32, marginTop: 28, color: "#cbd5e1", maxWidth: 900 }}>
        Six adversarial AI agents argue over every clause and hand you a LEXSCORE, verdicts and
        negotiation scripts.
      </div>
    </div>,
    size,
  );
}
