/**
 * Leaderboards Page
 *
 * Overall and category-based rankings with time filters
 */

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Crown,
  Medal,
} from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout";
import { PerformanceChart } from "@/components/dashboard";
import { RegisterModelDialog } from "@/components/leaderboard/LeaderboardClient";
import { LeaderboardActions } from "@/components/leaderboard/LeaderboardActions";

interface LeaderboardPageProps {
  searchParams: Promise<{ category?: string; time?: string }>;
}

async function getLeaderboardData(_category?: string, timeFilter?: string) {
  // Calculate date filter
  let startDate = new Date(0);
  if (timeFilter === "7d") {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeFilter === "30d") {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get all model runs with category scores
  const modelRuns = await prisma.modelRun.findMany({
    where: {
      benchmarkRun: {
        completedAt: {
          gte: startDate,
        },
        status: "COMPLETED",
      },
    },
    include: {
      categoryScores: {
        select: {
          totalScore: true,
        },
      },
      benchmarkRun: {
        select: {
          completedAt: true,
        },
      },
    },
  });

  // Calculate average scores per model
  const modelScores = new Map<string, { totalScore: number; count: number; runs: string[] }>();

  for (const run of modelRuns) {
    const avgScore =
      run.categoryScores.length > 0
        ? run.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) /
          run.categoryScores.length
        : 0;

    const existing = modelScores.get(run.modelId);
    if (existing) {
      existing.totalScore += avgScore;
      existing.count += 1;
    } else {
      modelScores.set(run.modelId, { totalScore: avgScore, count: 1, runs: [] });
    }
  }

  // Sort by average score descending
  const sortedOverall = Array.from(modelScores.entries())
    .map(([modelId, { totalScore, count }]) => ({
      modelId,
      avgScore: totalScore / count,
      runCount: count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10);

  // Get category leaderboards
  const categoryLeaderboards: Record<string, typeof sortedOverall> = {};

  const categories = await prisma.benchmarkCategory.findMany({
    select: { id: true, name: true },
  });

  for (const cat of categories) {
    // Optimized query: Fetch category scores with modelRun in a single query
    // This eliminates the N+1 query problem where we were querying modelRun separately for each score
    const categoryScoresWithModel = await prisma.categoryScore.findMany({
      where: {
        categoryId: cat.id,
        modelRun: {
          benchmarkRun: {
            completedAt: {
              gte: startDate,
            },
            status: "COMPLETED",
          },
        },
      },
      select: {
        totalScore: true,
        modelRun: {
          select: {
            modelId: true,
          },
        },
      },
    });

    // Aggregate scores by model ID
    const catModelScores = new Map<string, { totalScore: number; count: number }>();

    for (const scoreData of categoryScoresWithModel) {
      const modelId = scoreData.modelRun.modelId;
      const score = scoreData.totalScore;

      const existing = catModelScores.get(modelId);
      if (existing) {
        existing.totalScore += score;
        existing.count += 1;
      } else {
        catModelScores.set(modelId, {
          totalScore: score,
          count: 1,
        });
      }
    }

    categoryLeaderboards[cat.name] = Array.from(catModelScores.entries())
      .map(([modelId, { totalScore, count }]) => ({
        modelId,
        avgScore: totalScore / count,
        runCount: count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);
  }

  // Get performance trend data for top models
  const topModelIds = sortedOverall.slice(0, 5).map((m) => m.modelId);

  const trendData = await prisma.modelRun.findMany({
    where: {
      modelId: { in: topModelIds },
      benchmarkRun: {
        completedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        status: "COMPLETED",
      },
    },
    include: {
      benchmarkRun: {
        select: { completedAt: true },
      },
      categoryScores: {
        select: { totalScore: true },
      },
    },
    orderBy: {
      benchmarkRun: { completedAt: "asc" },
    },
    take: 100,
  });

  // Group by week and calculate averages
  const weeklyData = new Map<string, Record<string, { sum: number; count: number }>>();
  for (const run of trendData) {
    const week = getWeekString(run.benchmarkRun.completedAt);
    if (!weeklyData.has(week)) {
      weeklyData.set(week, {});
    }
    const weekData = weeklyData.get(week);
    if (weekData) {
      const avgScore =
        run.categoryScores.length > 0
          ? run.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) /
            run.categoryScores.length
          : 0;
      const modelData = weekData[run.modelId];
      if (!modelData) {
        weekData[run.modelId] = { sum: 0, count: 0 };
      }
      const updatedModelData = weekData[run.modelId];
      if (updatedModelData) {
        updatedModelData.sum += avgScore;
        updatedModelData.count += 1;
      }
    }
  }

  // Convert to chart data format
  const chartData = Array.from(weeklyData.entries()).map(([week, data]) => {
    const row: Record<string, string | number> = { date: week };
    for (const [modelId, scores] of Object.entries(data)) {
      if (typeof scores === "object" && "sum" in scores) {
        row[modelId] = scores.count > 0 ? scores.sum / scores.count : 0;
      }
    }
    return row as { date: string } & Record<string, string | number>;
  });

  return {
    overall: sortedOverall,
    categories: categoryLeaderboards,
    categoryList: categories,
    chartData,
    topModels: topModelIds,
  };
}

function getWeekString(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - d.getDay());
  return `Week ${Math.floor(startOfWeek.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-primary" />;
    case 2:
      return <Medal className="h-5 w-5 text-muted-foreground" />;
    case 3:
      return <Medal className="h-5 w-5 text-warning" />;
    default:
      return <span className="text-muted-foreground font-mono">#{rank}</span>;
  }
}

function getScoreColor(score: number): string {
  // Guard against NaN or invalid scores
  const validScore = Number.isFinite(score) ? score : 0;
  if (validScore >= 80) return "text-success";
  if (validScore >= 60) return "text-warning";
  return "text-error";
}

// Safe score utilities
function safeScoreValue(score: number | undefined | null): number {
  return Number.isFinite(score ?? 0) ? (score ?? 0) : 0;
}

function safeScoreDisplay(score: number | undefined | null, decimals: number = 1): string {
  const validScore = safeScoreValue(score ?? 0);
  return validScore.toFixed(decimals);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, safeScoreValue(score)));
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const params = await searchParams;
  const { category, time } = params;

  const data = await getLeaderboardData(category, time);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Leaderboard" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="animate-fade-in">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leaderboards</h1>
            <p className="text-muted-foreground mt-2">
              Top performing models across all benchmarks and categories
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <LeaderboardActions entries={data.overall} />
            <RegisterModelDialog />
            <Link href="/leaderboard?time=all">
              <Button
                variant={time === "all" || !time ? "default" : "outline"}
                size="sm"
              >
                All-time
              </Button>
            </Link>
            <Link href="/leaderboard?time=7d">
              <Button
                variant={time === "7d" ? "default" : "outline"}
                size="sm"
              >
                7 days
              </Button>
            </Link>
            <Link href="/leaderboard?time=30d">
              <Button
                variant={time === "30d" ? "default" : "outline"}
                size="sm"
              >
                30 days
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Performance Trend Chart */}
      {data.chartData.length > 0 && (
        <div className="animate-fade-in-up delay-100">
          <PerformanceChart
            data={data.chartData}
            models={data.topModels}
            type="line"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="animate-fade-in-up delay-200">
        <Tabs defaultValue={category || "overall"} className="space-y-4">
          <TabsList className="bg-surface border border-border p-1 rounded-lg flex-wrap">
            <TabsTrigger value="overall" asChild>
              <Link href="/leaderboard" className="px-4 py-2 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Overall
              </Link>
            </TabsTrigger>
            {data.categoryList.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.name} asChild>
                <Link
                  href={`/leaderboard?category=${cat.name}`}
                  className="px-4 py-2"
                >
                  {cat.name.replace("_", " ")}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overall Leaderboard */}
          <TabsContent value="overall" className="mt-4">
            <LeaderboardTable entries={data.overall} />
          </TabsContent>

          {/* Category Leaderboards */}
          {data.categoryList.map((cat) => (
            <TabsContent key={cat.id} value={cat.name} className="mt-4">
              <LeaderboardTable entries={data.categories[cat.name] || []} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

interface LeaderboardTableProps {
  entries: Array<{
    modelId: string;
    avgScore: number;
    runCount: number;
  }>;
}

function LeaderboardTable({ entries }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No leaderboard data available yet.</p>
          <p className="text-sm mt-2">Run some benchmarks to see rankings!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Models</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
                  Rank
                </th>
                <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
                  Model
                </th>
                <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">
                  Average Score
                </th>
                <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">
                  Runs
                </th>
                <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground w-32">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.modelId}
                  className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors"
                >
                  <td className="py-3 px-4">{getRankIcon(index + 1)}</td>
                  <td className="py-3 px-4 font-medium text-foreground">
                    {entry.modelId}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`text-lg font-semibold ${getScoreColor(
                        entry.avgScore
                      )}`}
                    >
                      {safeScoreDisplay(entry.avgScore)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground">
                    {entry.runCount}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Progress value={clampScore(entry.avgScore)} className="h-2 flex-1" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
