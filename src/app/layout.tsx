import type { Metadata } from "next";
import { GeistSans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const geistSans = GeistSans({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LLM Benchmark & Comparison Platform",
  description: "Truthful LLM benchmarking with real tasks, real outputs, real scores. Compare multiple AI models with your own API keys.",
  keywords: ["LLM", "benchmark", "AI", "comparison", "GPT", "Claude", "open source"],
  authors: [{ name: "LLM Benchmark Team" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${ibmPlexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
