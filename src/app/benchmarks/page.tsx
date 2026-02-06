/**
 * Benchmarks List Page
 *
 * Grid/list of all benchmarks with category filtering and search
 */

import { prisma } from "@/lib/prisma";
import { BenchmarkCard } from "@/components/dashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Sparkles, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { BenchmarkHistory } from "@/components/BenchmarkHistory";
import Link from "next/link";
import {
  evaluateBenchmarkQuality,
  summarizeBenchmarkQuality,
  type BenchmarkQualityResult,
} from "@/lib/benchmark-quality";

// Categories enum - matches Prisma schema
const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "CODING", label: "Coding" },
  { value: "WRITING", label: "Writing" },
  { value: "REASONING", label: "Reasoning" },
  { value: "DEBUGGING", label: "Debugging" },
  { value: "API_DESIGN", label: "API Design" },
  { value: "DATABASE_SCHEMA", label: "Database Schema" },
  { value: "UI_UX_DESIGN", label: "UI/UX Design" },
  { value: "DATA_ANALYSIS", label: "Data Analysis" },
];

interface BenchmarksPageProps {
  searchParams: Promise<{ category?: string; search?: string }>;
}

async function getBenchmarks(category?: string, search?: string) {
  const where: Record<string, unknown> = {
    isPublic: true,
  };

  if (category && category !== "ALL") {
    where.primaryCategory = category;
  }

  if (search?.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { description: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const benchmarks = await prisma.benchmark.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      prompt: true,
      primaryCategory: true,
      createdAt: true,
      difficulty: true,
      estimatedTokens: true,
      tags: true,
      categories: { select: { id: true } },
      _count: {
        select: { runs: true },
      },
    },
    take: 100,
  });

  const benchmarkIds = benchmarks.map((b) => b.id);
  const benchmarkRuns = await prisma.benchmarkRun.findMany({
    where: {
      benchmarkId: { in: benchmarkIds },
      status: "COMPLETED",
    },
    select: {
      benchmarkId: true,
      modelRuns: {
        where: { status: "COMPLETED" },
        select: {
          modelId: true,
          categoryScores: {
            select: { totalScore: true },
          },
        },
      },
    },
  });

  const runStats = new Map<
    string,
    { scoreTotal: number; scoreCount: number; models: Set<string> }
  >();

  for (const run of benchmarkRuns) {
    const stats = runStats.get(run.benchmarkId) || {
      scoreTotal: 0,
      scoreCount: 0,
      models: new Set<string>(),
    };

    for (const modelRun of run.modelRuns) {
      stats.models.add(modelRun.modelId);
      const categoryAvg =
        modelRun.categoryScores.length > 0
          ? modelRun.categoryScores.reduce((sum, score) => sum + score.totalScore, 0) /
            modelRun.categoryScores.length
          : 0;

      stats.scoreTotal += categoryAvg;
      stats.scoreCount += 1;
    }

    runStats.set(run.benchmarkId, stats);
  }

  return benchmarks.map((benchmark) => {
    const stats = runStats.get(benchmark.id);
    const avgScore =
      stats && stats.scoreCount > 0
        ? Number((stats.scoreTotal / stats.scoreCount).toFixed(1))
        : null;

    const quality = evaluateBenchmarkQuality({
      id: benchmark.id,
      name: benchmark.name,
      hasDescription: Boolean(benchmark.description?.trim()),
      hasPrompt: Boolean(benchmark.prompt?.trim()),
      hasDifficulty: Boolean(benchmark.difficulty),
      hasEstimatedTokens: Boolean(benchmark.estimatedTokens),
      hasTags: Boolean(benchmark.tags && benchmark.tags !== "[]"),
      categoryCount: benchmark.categories.length || 1,
      runCount: benchmark._count.runs,
      uniqueModelCount: stats?.models.size ?? 0,
      avgScore,
    });

    return {
      id: benchmark.id,
      name: benchmark.name,
      description: benchmark.description,
      primaryCategory: benchmark.primaryCategory,
      runCount: benchmark._count.runs,
      avgScore,
      quality,
    };
  });
}

function qualityBadge(result: BenchmarkQualityResult) {
  if (result.grade === "excellent") {
    return <Badge className="bg-success/10 text-success border-success/20">Ready</Badge>;
  }
  if (result.grade === "good") {
    return <Badge variant="secondary">Improving</Badge>;
  }
  return <Badge variant="destructive">Needs Work</Badge>;
}

export default async function BenchmarksPage({
  searchParams,
}: BenchmarksPageProps) {
  const { category, search } = await searchParams;

  // Get all benchmarks (for the "All" tab)
  const allBenchmarks = await getBenchmarks(undefined, undefined);
  const qualitySummary = summarizeBenchmarkQuality(allBenchmarks.map((b) => b.quality));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Benchmarks</h1>
          <p className="text-muted-foreground">
            Browse {allBenchmarks.length} benchmarks across 8 categories
          </p>
        </div>
        <Link href="/benchmarks/create">
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Create Benchmark
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Benchmark Readiness Score</p>
            <p className="text-2xl font-bold">{qualitySummary.overallScore}/100</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {qualitySummary.counts.excellent} ready / {qualitySummary.counts.good} improving / {qualitySummary.counts.needsWork} needs work
          </div>
        </div>
        {qualitySummary.topImprovements.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {qualitySummary.topImprovements.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <form className="animate-fade-in" method="get">
        <input type="hidden" name="category" value={category || ""} />
        <div className="relative flex items-center gap-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Search benchmarks..."
            defaultValue={search}
            className="pl-10 h-12"
          />
          <Button type="submit" variant="outline">Search</Button>
        </div>
      </form>

      {/* Local Benchmark History */}
      <div className="animate-fade-in">
        <BenchmarkHistory />
      </div>

      {/* Category Tabs */}
      <div className="animate-fade-in-up">
        <Tabs defaultValue={category || "ALL"}>
          <TabsList className="bg-surface border border-border p-1 rounded-lg">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.value}
                value={cat.value}
                asChild
              >
                <a
                  href={`?category=${cat.value === "ALL" ? "" : cat.value}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  className="px-4 py-2"
                >
                  {cat.label}
                </a>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* All Categories / Specific Category Content */}
          {CATEGORIES.map((cat) => (
            <TabsContent key={cat.value} value={cat.value} className="mt-6">
              <Suspense fallback={<div>Loading...</div>}>
                <BenchmarksGrid
                  category={cat.value === "ALL" ? undefined : cat.value}
                  search={search}
                />
              </Suspense>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

async function BenchmarksGrid({
  category,
  search,
}: {
  category?: string;
  search?: string;
}) {
  const benchmarks = await getBenchmarks(category, search);

  if (benchmarks.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-muted-foreground">
          {search
            ? `No benchmarks found matching "${search}"`
            : category
            ? `No benchmarks in ${category.replace("_", " ").toLowerCase()}`
            : "No benchmarks available"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {benchmarks.slice(0, 8).map((benchmark) => (
          <div key={`${benchmark.id}-quality`} className="text-xs">
            <span className="mr-2 text-muted-foreground">{benchmark.name}</span>
            {qualityBadge(benchmark.quality)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {benchmarks.map((benchmark, index) => (
          <BenchmarkCard
            key={benchmark.id}
            id={benchmark.id}
            name={benchmark.name}
            description={benchmark.description}
            category={benchmark.primaryCategory}
            runCount={benchmark.runCount}
            avgScore={benchmark.avgScore}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
