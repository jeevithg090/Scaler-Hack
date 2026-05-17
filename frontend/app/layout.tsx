import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEXGUARD — AI Contract Intelligence",
  description:
    "Adversarial multi-agent AI that fights for you before you sign. Upload any contract, offer letter, NDA, or ToS and get a battle-tested risk assessment in under 60 seconds.",
  keywords: [
    "contract analysis",
    "AI lawyer",
    "legal risk",
    "NDA review",
    "employment contract",
  ],
  openGraph: {
    title: "LEXGUARD — AI Contract Intelligence",
    description:
      "Six adversarial AI agents analyze your contract and give you the words to fight back.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
