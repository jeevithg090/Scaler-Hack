import type { Config } from "tailwindcss";

/**
 * LEXGUARD design tokens.
 *
 * The UI is dark-first. Text colours are chosen to meet WCAG AA (4.5:1) on `lex.bg`:
 *   slate-100 ≈ 16:1, slate-300 ≈ 12:1, slate-400 ≈ 7.4:1. Avoid slate-500 and darker for text.
 */
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        lex: {
          bg: "#0a0f1a",
          surface: "#08101c",
          card: "#111827",
          border: "#1e293b",
          accent: "#6366f1",
          "accent-soft": "#a5b4fc",
          red: "#ef4444",
          "red-soft": "#fca5a5",
          amber: "#f59e0b",
          green: "#22c55e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        // Smallest size used for labels and badges; nothing in the UI goes below this.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};
export default config;
