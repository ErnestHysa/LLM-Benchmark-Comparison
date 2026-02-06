/**
 * Fuzz Testing Page
 *
 * Test model robustness against adversarial inputs
 */

import { prisma } from "@/lib/prisma";
import { Shield, Bug } from "lucide-react";
import { Breadcrumb } from "@/components/layout";
import { FuzzTestRunner } from "@/components/fuzz/FuzzTestRunner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fuzz Testing - LLM Benchmark",
  description: "Test model robustness against adversarial inputs",
};

async function getFuzzData() {
  // Get available models
  const modelRuns = await prisma.modelRun.findMany({
    select: { modelId: true },
    distinct: ["modelId"],
    take: 50,
  });

  return {
    models: modelRuns.map((m) => m.modelId),
  };
}

export default async function FuzzTestingPage() {
  const data = await getFuzzData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Shield className="h-5 w-5 text-orange-500" />
            </div>
            <Breadcrumb items={[
              { label: "Home", href: "/" },
              { label: "Fuzz Testing", current: true },
            ]} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <Bug className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Adversarial Fuzz Testing</h1>
              <p className="text-sm text-muted-foreground">
                Test model robustness against typos, injections, jailbreaks, and edge cases
              </p>
            </div>
          </div>
        </div>

        <FuzzTestRunner models={data.models} />
      </main>
    </div>
  );
}
