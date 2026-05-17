import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEXGUARD — AI Contract Intelligence",
  description: "Adversarial multi-agent contract analysis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
