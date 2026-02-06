/**
 * Custom Benchmark Builder Page
 *
 * Create custom benchmarks with rich prompt editor,
 * category selection, and template support
 */

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout";
import { BenchmarkBuilder } from "@/components/benchmarks/BenchmarkBuilder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Benchmark - LLM Benchmark",
  description: "Create custom benchmarks to test LLM capabilities",
};

async function getBuilderData() {
  const [categories, templates, collections] = await Promise.all([
    // Get all category types as array (without icon functions)
    Promise.resolve([
      { value: "CODING", label: "Coding", color: "bg-blue-500" },
      { value: "WRITING", label: "Writing", color: "bg-green-500" },
      { value: "REASONING", label: "Reasoning", color: "bg-purple-500" },
      { value: "DEBUGGING", label: "Debugging", color: "bg-red-500" },
      { value: "API_DESIGN", label: "API Design", color: "bg-yellow-500" },
      { value: "DATABASE_SCHEMA", label: "Database Schema", color: "bg-cyan-500" },
      { value: "UI_UX_DESIGN", label: "UI/UX Design", color: "bg-pink-500" },
      { value: "DATA_ANALYSIS", label: "Data Analysis", color: "bg-orange-500" },
    ]),
    prisma.benchmarkTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: "desc" }, { usesCount: "desc" }],
      take: 12,
    }),
    prisma.benchmarkCollection.findMany({
      orderBy: [{ isSystem: "desc" }, { order: "asc" }],
      take: 20,
    }),
  ]);

  // Transform templates to match expected interface
  const transformedTemplates = templates.map((t) => ({
    ...t,
    tags: t.tags ? (JSON.parse(t.tags) as string[]) : [],
  }));

  return { categories, templates: transformedTemplates, collections };
}

export default async function CreateBenchmarkPage() {
  const data = await getBuilderData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/benchmarks">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to Benchmarks
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <Breadcrumb items={[
                { label: "Benchmarks", href: "/benchmarks" },
                { label: "Create Custom", current: true },
              ]} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Create Custom Benchmark</h1>
              <p className="text-sm text-muted-foreground">
                Design your own benchmark to test specific LLM capabilities
              </p>
            </div>
          </div>
        </div>

        <BenchmarkBuilder
          categories={data.categories}
          templates={data.templates}
          collections={data.collections}
        />
      </main>
    </div>
  );
}
