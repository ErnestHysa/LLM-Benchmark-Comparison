/**
 * Analytics Page
 *
 * Advanced statistical analysis with:
 * - Confidence intervals
 * - Statistical significance tests
 * - Outlier detection
 * - Trend analysis
 * - AI-generated insights
 */

import { prisma } from "@/lib/prisma";
import {
  BarChart3,
} from "lucide-react";
import { Breadcrumb } from "@/components/layout";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics - LLM Benchmark",
  description: "Advanced statistical analysis and AI-generated insights",
};

async function getAnalyticsData() {
  // Get available models and benchmarks for filters
  const [models, benchmarks] = await Promise.all([
    prisma.modelRun.findMany({
      select: { modelId: true },
      distinct: ["modelId"],
      take: 50,
    }),
    prisma.benchmark.findMany({
      select: { id: true, name: true },
      where: { isPublic: true },
      take: 50,
    }),
  ]);

  return {
    models: models.map((m) => m.modelId),
    benchmarks,
  };
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <Breadcrumb items={[
                { label: "Home", href: "/" },
                { label: "Analytics", current: true },
              ]} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Advanced statistical analysis and AI-powered insights
          </p>
        </div>

        <AnalyticsDashboard
          models={data.models}
          benchmarks={data.benchmarks}
        />
      </main>
    </div>
  );
}
