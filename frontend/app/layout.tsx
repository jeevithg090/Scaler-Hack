import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "LEXGUARD — AI Contract Intelligence",
  description:
    "Adversarial multi-agent AI that fights for you before you sign. Upload any contract, offer letter, NDA, or ToS and get a battle-tested risk assessment in under 60 seconds.",
  keywords: ["contract analysis", "AI lawyer", "legal risk", "NDA review", "employment contract"],
  openGraph: {
    title: "LEXGUARD — AI Contract Intelligence",
    description:
      "Six adversarial AI agents analyze your contract and give you the words to fight back.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
