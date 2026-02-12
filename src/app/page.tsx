/**
 * Dashboard Home Page
 *
 * Overview cards, quick actions, performance chart, and recent benchmarks
 * Data fetched from SQLite via Prisma
 */

import { prisma } from "@/lib/prisma";
import { ScoreCard, BenchmarkCard, PerformanceChart } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BarChart3, Clock, Trophy, TrendingUp } from "lucide-react";

async function getDashboardData() {
  const [
    totalRuns,
    totalBenchmarks,
    activeModels,
    recentRuns,
    averageScores,
  ] = await Promise.all([
    // Total benchmark runs
    prisma.benchmarkRun.count(),
    // Total benchmarks
    prisma.benchmark.count(),
    // Active models (unique model IDs from all runs)
    prisma.modelRun.groupBy({
      by: ["modelId"],
      _count: true,
    }).then((results) => results.length),
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
    prisma.categoryScore.groupBy({
      by: ["categoryId"],
      _avg: {
        totalScore: true,
      },
    }).then(async (scores) => {
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

  // Calculate average scores for each benchmark
  const benchmarksWithScores = await Promise.all(
    recentBenchmarks.map(async (benchmark) => {
      // Get all model runs for this benchmark's runs
      const benchmarkRunIds = (
        await prisma.benchmarkRun.findMany({
          where: { benchmarkId: benchmark.id },
          select: { id: true },
        })
      ).map((run) => run.id);

      let avgScore: number | null = null;

      if (benchmarkRunIds.length > 0) {
        // Get all category scores for these benchmark runs
        const categoryScores = await prisma.categoryScore.findMany({
          where: {
            modelRun: {
              benchmarkRunId: { in: benchmarkRunIds },
            },
          },
          select: { totalScore: true },
        });

        if (categoryScores.length > 0) {
          const totalScore = categoryScores.reduce((sum, score) => sum + score.totalScore, 0);
          avgScore = totalScore / categoryScores.length;
        }
      }

      return {
        ...benchmark,
        avgScore,
      };
    })
  );

  return {
    totalRuns,
    totalBenchmarks,
    activeModels,
    recentRuns,
    averageScores,
    recentBenchmarks: benchmarksWithScores,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const {
    totalRuns,
    totalBenchmarks,
    activeModels,
    recentRuns,
    averageScores,
    recentBenchmarks,
  } = data;

  // Get last 4 weeks of performance data from ModelRun (which has categoryScores)
  const weeklyData = await prisma.modelRun.findMany({
    where: {
      status: "COMPLETED",
      completedAt: {
        gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), // Last 4 weeks
      },
    },
    include: {
      categoryScores: {
        select: { totalScore: true },
      },
    },
    orderBy: { completedAt: "asc" },
    take: 200,
  });

  // Group by week and calculate averages
  const weekMap = new Map<number, Map<string, { sum: number; count: number }>>();

  for (const run of weeklyData) {
    const weekNum = Math.floor(
      (Date.now() - new Date(run.completedAt!).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    if (!weekMap.has(weekNum)) {
      weekMap.set(weekNum, new Map());
    }

    const weekModels = weekMap.get(weekNum)!;
    const avgScore = run.categoryScores.length > 0
      ? run.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) / run.categoryScores.length
      : 0;

    // Use a generic identifier since we don't have model info at this level
    const modelKey = "Average";
    const existing = weekModels.get(modelKey);
    if (existing) {
      existing.sum += avgScore;
      existing.count += 1;
    } else {
      weekModels.set(modelKey, { sum: avgScore, count: 1 });
    }
  }

  // Convert to chart format
  const chartData = Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 4)
    .map(([weekNum, weekModels]) => {
      const row: Record<string, string | number> = { date: `Week ${4 - weekNum}` };

      for (const [modelKey, scores] of weekModels.entries()) {
        row[modelKey] = scores.count > 0 ? scores.sum / scores.count : 0;
      }

      return row;
    });

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the LLM Benchmark Platform. Run benchmarks to compare model performance.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              ? (averageScores.reduce((sum, s) => sum + s.avgScore, 0) / averageScores.length).toFixed(1)
              : "--"
          }
          description="Across all categories"
          icon={<Clock className="h-5 w-5" />}
          color="warning"
        />
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-in-up delay-100">
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/benchmarks">
            <Button size="lg">
              <BarChart3 className="h-4 w-4 mr-2" />
              Run New Benchmark
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" size="lg">
              <Trophy className="h-4 w-4 mr-2" />
              View Leaderboards
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="outline" size="lg">
              <Clock className="h-4 w-4 mr-2" />
              View History
            </Button>
          </Link>
        </div>
      </div>

      {/* Performance Chart and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <div className="animate-fade-in-up delay-200">
          <PerformanceChart
            data={chartData as any}
            models={["GPT-4o", "Claude 3.5 Sonnet"]}
            type="line"
          />
        </div>

        {/* Recent Activity */}
        <div className="animate-fade-in-up delay-300">
          <div className="card p-6 h-full">
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
            {recentRuns.length > 0 ? (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface/50 border border-border"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {run.benchmark.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.startedAt.toLocaleDateString()} • {run.modelRuns.length} models
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">
                      Completed
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No benchmark runs yet. Run your first benchmark to see activity here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Benchmarks */}
      <div className="animate-fade-in-up delay-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Recent Benchmarks</h2>
          <Link href="/benchmarks">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="animate-fade-in delay-500 card p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Ready to Benchmark</h2>
            <p className="text-muted-foreground">
              You have {totalBenchmarks} benchmarks available. Configure your API keys in
              Settings and run your first benchmark to see model comparisons.
            </p>
            <Link href="/benchmarks">
              <Button size="lg">
                <BarChart3 className="h-4 w-4 mr-2" />
                Browse Benchmarks
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
