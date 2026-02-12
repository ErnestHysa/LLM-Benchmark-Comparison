/**
 * Benchmarks List Page
 *
 * Grid/list of all benchmarks with category filtering and search
 */

import { prisma } from "@/lib/prisma";
import { BenchmarkCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { Suspense } from "react";
import { BenchmarkHistory } from "@/components/BenchmarkHistory";
import Link from "next/link";
import { BenchmarksFilters, CategoryTabs } from "@/components/benchmarks/BenchmarksFilters";

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

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const benchmarks = await prisma.benchmark.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      primaryCategory: true,
      createdAt: true,
      _count: {
        select: { runs: true },
      },
    },
    take: 100,
  });

  // Get run counts and average scores
  const benchmarkIds = benchmarks.map((b) => b.id);
  const runCounts = await prisma.benchmarkRun.groupBy({
    by: ["benchmarkId"],
    where: { benchmarkId: { in: benchmarkIds }, status: "COMPLETED" },
    _count: true,
  });

  // Get average scores from Score table
  const scores = await prisma.score.findMany({
    where: {
      modelRun: {
        benchmarkRun: {
          benchmarkId: { in: benchmarkIds },
          status: "COMPLETED",
        },
      },
    },
    include: {
      modelRun: {
        select: {
          benchmarkRun: {
            select: { benchmarkId: true },
          },
        },
      },
    },
  });

  // Calculate average scores per benchmark
  const avgScoresMap = new Map<string, number>();
  const scoresByBenchmark = scores.reduce((acc, score) => {
    const benchmarkId = score.modelRun.benchmarkRun.benchmarkId;
    if (!acc.has(benchmarkId)) {
      acc.set(benchmarkId, []);
    }
    acc.get(benchmarkId)!.push(score.value);
    return acc;
  }, new Map<string, number[]>());

  scoresByBenchmark.forEach((scoreValues, benchmarkId) => {
    const avg = scoreValues.reduce((sum, val) => sum + val, 0) / scoreValues.length;
    avgScoresMap.set(benchmarkId, Math.round(avg * 10) / 10); // Round to 1 decimal
  });

  // Combine data
  const benchmarksWithData = benchmarks.map((benchmark) => {
    const runCount = runCounts.find((r) => r.benchmarkId === benchmark.id)?._count ?? 0;
    const avgScore = avgScoresMap.get(benchmark.id) ?? null;

    return {
      ...benchmark,
      runCount,
      avgScore,
    };
  });

  return { benchmarks: benchmarksWithData };
}

export default async function BenchmarksPage({
  searchParams,
}: BenchmarksPageProps) {
  const { category, search } = await searchParams;

  // Get all benchmarks (for the "All" tab)
  const allBenchmarks = await getBenchmarks(undefined, undefined);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Benchmarks</h1>
          <p className="text-muted-foreground">
            Browse {allBenchmarks.benchmarks.length} benchmarks across 8 categories
          </p>
        </div>
        <Link href="/benchmarks/create">
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Create Benchmark
          </Button>
        </Link>
      </div>

      {/* Search */}
      <BenchmarksFilters initialSearch={search} />

      {/* Category Tabs */}
      <div className="animate-fade-in">
        <Suspense fallback={<div>Loading...</div>}>
          <CategoryTabs currentCategory={category || "ALL"} />
        </Suspense>
      </div>

      {/* Local Benchmark History */}
      <div className="animate-fade-in-up">
        <BenchmarkHistory />
      </div>

      {/* Category Content */}
      <div className="animate-fade-in-up">
        <Suspense fallback={<div>Loading...</div>}>
          <CategoryTabsContent currentCategory={category || "ALL"} search={search} />
        </Suspense>
      </div>
    </div>
  );
}

async function CategoryTabsContent({
  currentCategory,
  search,
}: {
  currentCategory: string;
  search?: string;
}) {
  const category = currentCategory === "ALL" ? undefined : currentCategory;
  const { benchmarks } = await getBenchmarks(category, search);

  if (benchmarks.length === 0) {
    return (
      <div className="card p-12 text-center mt-6">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
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
  );
}
