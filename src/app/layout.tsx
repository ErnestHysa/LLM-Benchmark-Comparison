import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { ErrorBoundary, AsyncErrorBoundary } from "@/components/errors/ErrorBoundary";

const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LLM Benchmark & Comparison Platform",
  description: "Truthful LLM benchmarking with real tasks, real outputs, real scores. Compare multiple AI models with your own API keys.",
  keywords: ["LLM", "benchmark", "AI", "comparison", "GPT", "Claude", "open source"],
  authors: [{ name: "LLM Benchmark Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      <body className={`${inter.variable} ${ibmPlexMono.variable}`}>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>

        <ErrorBoundary>
          <AsyncErrorBoundary>
            <LayoutWrapper>{children}</LayoutWrapper>
          </AsyncErrorBoundary>
        </ErrorBoundary>

        {/* Toast notifications */}
        <Toaster />
      </body>
    </html>
  );
}
