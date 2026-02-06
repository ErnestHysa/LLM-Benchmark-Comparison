/**
 * Benchmarks List Page
 *
 * Grid/list of all benchmarks with category filtering and search
 */

import { prisma } from "@/lib/prisma";
import { BenchmarkCard } from "@/components/dashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { BenchmarkHistory } from "@/components/BenchmarkHistory";
import Link from "next/link";

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
    where: { benchmarkId: { in: benchmarkIds } },
    _count: true,
  });

  // Combine data
  const benchmarksWithData = benchmarks.map((benchmark) => {
    const runCount = runCounts.find((r) => r.benchmarkId === benchmark.id)?._count ?? 0;

    // Get average score (simplified)
    const avgScore = null; // Would need more complex query

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
      <div className="animate-fade-in">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search benchmarks..."
            defaultValue={search}
            className="pl-10 h-12"
          />
        </div>
      </div>

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
                  href={`?category=${cat.value === "ALL" ? "" : cat.value}`}
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
  const { benchmarks } = await getBenchmarks(category, search);

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
  );
}
