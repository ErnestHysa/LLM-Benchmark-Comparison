/**
 * A/B Comparison Page
 *
 * Blind testing, battle mode, diff viewer, and tournaments
 * Models are loaded client-side from SettingsManager (localStorage)
 */

import { Scale, Sparkles } from "lucide-react";
import { Breadcrumb } from "@/components/layout";
import { ABComparisonTool } from "@/components/compare/ABComparisonTool";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "A/B Comparison - LLM Benchmark",
  description: "Blind testing and head-to-head model comparisons",
};

export default function ComparePage() {
  // Models are loaded client-side from SettingsManager
  // This ensures we get the user's exact enabled models from their Settings
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      {/* Header */}
      <header className="border-b border-border/50 bg-surface/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg shadow-primary/5">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <Breadcrumb items={[
              { label: "Home", href: "/" },
              { label: "Comparison", current: true },
            ]} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-violet-500 rounded-2xl blur-xl opacity-20 animate-pulse" />
                <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/5 border border-primary/20 shadow-xl">
                  <Scale className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                  Model Comparison
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Beta
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1 max-w-xl">
                  Compare models head-to-head with blind testing, battle mode, diff analysis, and tournament brackets
                </p>
              </div>
            </div>
          </div>
        </div>

        <ABComparisonTool />
      </main>
    </div>
  );
}
