import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        lex: {
          bg: "#0a0f1a",
          card: "#111827",
          accent: "#6366f1",
          red: "#ef4444",
          amber: "#f59e0b",
          green: "#22c55e",
        },
      },
    },
  },
  plugins: [],
};
export default config;
