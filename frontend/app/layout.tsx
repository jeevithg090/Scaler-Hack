import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const DESCRIPTION =
  "Adversarial multi-agent contract analysis. Upload an offer letter, NDA, freelance agreement or terms of service and get a LEXSCORE, clause-by-clause verdicts and negotiation scripts.";

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LEXGUARD — AI Contract Intelligence",
    template: "%s · LEXGUARD",
  },
  description: DESCRIPTION,
  applicationName: "LEXGUARD",
  keywords: ["contract analysis", "contract review", "legal risk", "NDA review", "offer letter"],
  openGraph: {
    title: "LEXGUARD — AI Contract Intelligence",
    description:
      "Six adversarial AI agents analyze your contract and give you the words to fight back.",
    type: "website",
    siteName: "LEXGUARD",
  },
  twitter: {
    card: "summary_large_image",
    title: "LEXGUARD — AI Contract Intelligence",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
