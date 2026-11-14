import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analysis report",
  description: "LEXGUARD contract analysis: LEXSCORE, clause verdicts and negotiation scripts.",
  robots: { index: false, follow: false },
};

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
