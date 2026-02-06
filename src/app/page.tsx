/**
 * Dashboard Home Page
 *
 * Overview cards, quick actions, performance chart, and recent benchmarks
 * Data fetched from SQLite via Prisma
 */

import { prisma } from "@/lib/prisma";
import { ScoreCard, BenchmarkCard, PerformanceChart } from "@/components/dashboard";
import type { DataPoint } from "@/components/dashboard/PerformanceChart";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BarChart3, Clock, Trophy, TrendingUp } from "lucide-react";

async function getDashboardData() {
  try {
    const [
      totalRuns,
      totalBenchmarks,
      activeModels,
      recentRuns,
      averageScores,
      completedModelRuns,
    ] = await Promise.all([
      // Total benchmark runs
      prisma.benchmarkRun.count(),
      // Total benchmarks
      prisma.benchmark.count(),
      // Active models (unique model IDs from all runs)
      prisma.modelRun
        .groupBy({
          by: ["modelId"],
          _count: true,
        })
        .then((results) => results.length),
      // Recent runs with benchmark info
      prisma.benchmarkRun.findMany({
        take: 3,
        orderBy: { startedAt: "desc" },
        include: {
          benchmark: {
            select: {
              id: true,
              name: true,
              description: true,
              primaryCategory: true,
            },
          },
          modelRuns: {
            select: {
              id: true,
              modelId: true,
              status: true,
            },
          },
        },
      }),
      // Average scores by category
      prisma.categoryScore
        .groupBy({
          by: ["categoryId"],
          _avg: {
            totalScore: true,
          },
        })
        .then(async (scores) => {
          const categoryIds = scores.map((s) => s.categoryId);
          const categories = await prisma.benchmarkCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          });

          return scores.map((score) => {
            const category = categories.find((c) => c.id === score.categoryId);
            return {
              category: category?.name || "Unknown",
              avgScore: score._avg.totalScore ?? 0,
            };
          });
        }),
      prisma.modelRun.findMany({
        where: { status: "COMPLETED", completedAt: { not: null } },
        include: {
          categoryScores: {
            select: { totalScore: true },
          },
        },
        orderBy: { completedAt: "asc" },
        take: 500,
      }),
    ]);

    // Get recent benchmarks with their run counts and avg scores
    const recentBenchmarks = await prisma.benchmark.findMany({
      take: 6,
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
    });

    const benchmarksWithScores = recentBenchmarks.map((benchmark) => ({
      ...benchmark,
      avgScore: null, // Would need complex query for accurate avg
    }));

    const formatWeekKey = (date: Date) => {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      weekStart.setHours(0, 0, 0, 0);

      return weekStart.toISOString().slice(0, 10);
    };

    const weekBuckets = new Map<string, Map<string, { total: number; count: number }>>();
    for (const modelRun of completedModelRuns) {
      if (!modelRun.completedAt || modelRun.categoryScores.length === 0) {
        continue;
      }

      const weekKey = formatWeekKey(modelRun.completedAt);
      const modelMap =
        weekBuckets.get(weekKey) || new Map<string, { total: number; count: number }>();

      const avgScore =
        modelRun.categoryScores.reduce((sum, score) => sum + score.totalScore, 0) /
        modelRun.categoryScores.length;
      const current = modelMap.get(modelRun.modelId) || { total: 0, count: 0 };

      modelMap.set(modelRun.modelId, {
        total: current.total + avgScore,
        count: current.count + 1,
      });
      weekBuckets.set(weekKey, modelMap);
    }

    const sortedWeeks = Array.from(weekBuckets.keys()).sort().slice(-4);
    const modelFrequency = new Map<string, number>();
    for (const weekKey of sortedWeeks) {
      const modelsInWeek = weekBuckets.get(weekKey);
      if (!modelsInWeek) continue;

      for (const modelId of modelsInWeek.keys()) {
        modelFrequency.set(modelId, (modelFrequency.get(modelId) || 0) + 1);
      }
    }

    const chartModels = Array.from(modelFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([modelId]) => modelId);

    const chartData: DataPoint[] = sortedWeeks.map((weekKey) => {
      const weekModels =
        weekBuckets.get(weekKey) || new Map<string, { total: number; count: number }>();
      const row: DataPoint = { date: weekKey };

      for (const modelId of chartModels) {
        const stats = weekModels.get(modelId);
        row[modelId] = stats ? Number((stats.total / stats.count).toFixed(1)) : 0;
      }

      return row;
    });

    return {
      dataLoadError: false,
      totalRuns,
      totalBenchmarks,
      activeModels,
      recentRuns,
      averageScores,
      recentBenchmarks: benchmarksWithScores,
      chartData,
      chartModels,
    };
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    return {
      dataLoadError: true,
      totalRuns: 0,
      totalBenchmarks: 0,
      activeModels: 0,
      recentRuns: [],
      averageScores: [],
      recentBenchmarks: [],
      chartData: [] as DataPoint[],
      chartModels: [],
    };
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const {
    dataLoadError,
    totalRuns,
    totalBenchmarks,
    activeModels,
    recentRuns,
    averageScores,
    recentBenchmarks,
    chartData,
    chartModels,
  } = data;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the LLM Benchmark Platform. Run benchmarks to compare model performance.
        </p>
      </div>

      {/* Setup warning */}

      {dataLoadError && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Dashboard is running in fallback mode because benchmark tables are not initialized yet.
          Run{" "}
          <code className="mx-1 rounded bg-background px-1 py-0.5 text-foreground">
            npm run db:push
          </code>
          and optionally{" "}
          <code className="mx-1 rounded bg-background px-1 py-0.5 text-foreground">
            npm run db:seed
          </code>
          .
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreCard
          title="Total Benchmarks"
          value={totalBenchmarks}
          description="Available tests"
          icon={<BarChart3 className="h-5 w-5" />}
          color="primary"
        />
        <ScoreCard
          title="Runs Completed"
          value={totalRuns}
          description="Benchmark executions"
          icon={<Trophy className="h-5 w-5" />}
          color="success"
        />
        <ScoreCard
          title="Active Models"
          value={activeModels}
          description="Configured for testing"
          icon={<TrendingUp className="h-5 w-5" />}
          color="info"
        />
        <ScoreCard
          title="Avg Score"
          value={
            averageScores.length > 0
              ? (
                  averageScores.reduce((sum, s) => sum + s.avgScore, 0) / averageScores.length
                ).toFixed(1)
              : "--"
          }
          description="Across all categories"
          icon={<Clock className="h-5 w-5" />}
          color="warning"
        />
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-in-up delay-100">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/benchmarks">
            <Button size="lg">
              <BarChart3 className="mr-2 h-4 w-4" />
              Run New Benchmark
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" size="lg">
              <Trophy className="mr-2 h-4 w-4" />
              View Leaderboards
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="outline" size="lg">
              <Clock className="mr-2 h-4 w-4" />
              View History
            </Button>
          </Link>
        </div>
      </div>

      {/* Performance Chart and Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Performance Chart */}
        <div className="animate-fade-in-up delay-200">
          <PerformanceChart data={chartData} models={chartModels} type="line" />
        </div>

        {/* Recent Activity */}
        <div className="animate-fade-in-up delay-300">
          <div className="card h-full p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Activity</h2>
            {recentRuns.length > 0 ? (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 p-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {run.benchmark.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.startedAt.toLocaleDateString()} • {run.modelRuns.length} models
                      </p>
                    </div>
                    <span className="rounded bg-success/10 px-2 py-1 text-xs text-success">
                      Completed
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No benchmark runs yet. Run your first benchmark to see activity here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Benchmarks */}
      <div className="animate-fade-in-up delay-400">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Recent Benchmarks</h2>
          <Link href="/benchmarks">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recentBenchmarks.map((benchmark, index) => (
            <BenchmarkCard
              key={benchmark.id}
              id={benchmark.id}
              name={benchmark.name}
              description={benchmark.description}
              category={benchmark.primaryCategory}
              runCount={benchmark._count.runs}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Empty State - First Time */}
      {totalRuns === 0 && (
        <div className="animate-fade-in card p-8 text-center delay-500">
          <div className="mx-auto max-w-md space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Ready to Benchmark</h2>
            <p className="text-muted-foreground">
              You have {totalBenchmarks} benchmarks available. Configure your API keys in Settings
              and run your first benchmark to see model comparisons.
            </p>
            <Link href="/benchmarks">
              <Button size="lg">
                <BarChart3 className="mr-2 h-4 w-4" />
                Browse Benchmarks
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
