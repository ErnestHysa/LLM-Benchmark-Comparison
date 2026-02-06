import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { ErrorBoundary, AsyncErrorBoundary } from "@/components/errors/ErrorBoundary";

export const metadata: Metadata = {
  title: "LLM Benchmark & Comparison Platform",
  description:
    "Truthful LLM benchmarking with real tasks, real outputs, real scores. Compare multiple AI models with your own API keys.",
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
      <body>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
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
