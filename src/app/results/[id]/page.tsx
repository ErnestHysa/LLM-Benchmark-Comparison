/**
 * Results View Page
 *
 * Comprehensive view of a benchmark run with model comparisons,
 * detailed metrics, winner highlights, and export functionality
 */

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Crown,
  Clock,
  Users,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout";
import { ShareButton } from "@/components/benchmarks/ShareButton";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ExportableResult } from "@/lib/export";
import { PerformanceChart } from "@/components/dashboard";
import { ResultsClient } from "@/components/results/ResultsClient";

interface ResultsPageProps {
  params: Promise<{ id: string }>;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  totalScore: number;
}

export interface ModelResult {
  modelId: string;
  modelRunId: string;
  totalScore: number;
  categoryBreakdown: CategoryBreakdown[];
  status: string;
  output?: string;
  error?: string;
}

async function getBenchmarkRun(id: string) {
  const run = await prisma.benchmarkRun.findUnique({
    where: { id },
    include: {
      benchmark: {
        include: {
          categories: {
            select: { id: true, name: true, color: true },
          },
        },
      },
      modelRuns: {
        include: {
          categoryScores: {
            include: {
              category: {
                select: { id: true, name: true },
              },
            },
          },
          scores: {
            include: {
              category: {
                select: { id: true, name: true },
              },
              metric: {
                select: { id: true, name: true, weight: true },
              },
              metricScores: {
                include: {
                  metric: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return run;
}

const categoryColors: Record<string, string> = {
  CODING: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  WRITING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  REASONING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  DEBUGGING: "bg-red-500/10 text-red-500 border-red-500/20",
  API_DESIGN: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  DATABASE_SCHEMA: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  UI_UX_DESIGN: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  DATA_ANALYSIS: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-error";
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;
  const run = await getBenchmarkRun(id);

  if (!run) {
    notFound();
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "History", href: "/history" },
    { label: `Run ${run.id.slice(0, 8)}` },
  ];

  // Calculate scores and rankings from scores (not categoryScores)
  const modelResults = run.modelRuns.map((modelRun) => {
    // Calculate total score from all scores
    const totalScore =
      modelRun.scores.length > 0
        ? modelRun.scores.reduce((sum, s) => sum + s.value, 0) /
          modelRun.scores.length
        : 0;

    // Group by category
    const categoryMap = new Map<string, { totalScore: number; count: number }>();
    for (const score of modelRun.scores) {
      const existing = categoryMap.get(score.categoryId);
      if (existing) {
        existing.totalScore += score.value;
        existing.count += 1;
      } else {
        categoryMap.set(score.categoryId, { totalScore: score.value, count: 1 });
      }
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(
      ([categoryId, { totalScore, count }]) => {
        const cat = modelRun.categoryScores.find(
          (cs) => cs.categoryId === categoryId
        );
        return {
          categoryId,
          categoryName: cat?.category.name || "Unknown",
          totalScore: totalScore / count,
        };
      }
    );

    // Build metrics with explanations
    const metrics = modelRun.scores.map((score) => {
      const explanations = score.metricScores?.map((ms) => ({
        metricName: ms.metric.name,
        explanation: ms.explanation,
        value: ms.value,
      })) || [];

      return {
        category: score.category.name,
        metricName: score.metric?.name || "Overall",
        score: score.value,
        weight: score.metric?.weight || 1,
        confidence: score.aiConfidence,
        explanations: explanations.filter((e) => e.explanation),
      };
    });

    // Check for error in output
    const error = modelRun.status === "FAILED" ? modelRun.output : undefined;

    return {
      modelId: modelRun.modelId,
      modelRunId: modelRun.id,
      totalScore,
      categoryBreakdown,
      status: modelRun.status,
      output: modelRun.output,
      error,
      metrics,
    };
  });

  // Sort by total score descending
  const sortedResults = modelResults.sort((a, b) => b.totalScore - a.totalScore);
  const winner = sortedResults[0];

  // Get all unique categories
  const allCategories = Array.from(
    new Set(sortedResults.flatMap((r) => r.categoryBreakdown.map((c) => c.categoryName)))
  );

  // Prepare export data
  const exportData: ExportableResult = {
    runId: run.id,
    benchmarkName: run.benchmark.name,
    benchmarkDescription: run.benchmark.description,
    completedAt: run.completedAt?.toISOString() || new Date().toISOString(),
    models: sortedResults.map((r, index) => ({
      rank: index + 1,
      modelId: r.modelId,
      totalScore: r.totalScore,
      categoryScores: r.categoryBreakdown.map((c) => ({
        category: c.categoryName,
        score: c.totalScore,
      })),
    })),
  };

  // Prepare chart data
  const chartData = sortedResults.slice(0, 5).map((result) => {
    const dataPoint: Record<string, string | number> = {
      model: result.modelId.length > 15
        ? result.modelId.slice(0, 15) + "..."
        : result.modelId,
      };
    result.categoryBreakdown.forEach((cat) => {
      dataPoint[cat.categoryName] = cat.totalScore;
    });
    return dataPoint as { date: string } & Record<string, string | number>;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="animate-fade-in">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant="outline"
                className={categoryColors[run.benchmark.primaryCategory]}
              >
                {run.benchmark.primaryCategory.replace("_", " ")}
              </Badge>
              <Badge
                variant="outline"
                className="bg-success/10 text-success border-success/20"
              >
                {run.status}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {run.benchmark.name}
            </h1>
            <p className="text-muted-foreground mt-2">
              {run.benchmark.description}
            </p>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {run.completedAt
                    ? run.completedAt.toLocaleDateString()
                    : "In progress"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{run.modelRuns.length} models tested</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton
              title={`${winner?.modelId || "Model"} wins ${run.benchmark.name}`}
              url={`/results/${id}`}
            />
            <ExportButtons data={exportData} className="flex items-center gap-2" />
          </div>
        </div>
      </div>

      {/* Winner Highlight */}
      {winner && (
        <div className="animate-fade-in-up delay-100">
          <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {winner.modelId}
                    </h2>
                    <Badge className="bg-primary text-primary-fg">
                      <Trophy className="h-3 w-3 mr-1" />
                      Best Overall
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Scored {winner.totalScore.toFixed(1)}% - highest across all
                    categories
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-primary">
                    {winner.totalScore.toFixed(0)}
                  </div>
                  <div className="text-sm text-muted-foreground">points</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="animate-fade-in-up delay-200">
        <Tabs defaultValue="comparison" className="space-y-4">
          <TabsList className="bg-surface border border-border p-1 rounded-lg">
            <TabsTrigger value="comparison">Model Comparison</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Metrics</TabsTrigger>
            <TabsTrigger value="chart">Performance Chart</TabsTrigger>
          </TabsList>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Rankings</CardTitle>
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
                          Overall
                        </th>
                        {allCategories.map((cat) => (
                          <th
                            key={cat}
                            className="py-3 px-4 text-right text-sm font-medium text-muted-foreground"
                          >
                            {cat.replace("_", " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((result, index) => (
                        <tr
                          key={result.modelRunId}
                          className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            {index === 0 ? (
                              <Badge className="bg-primary text-primary-fg">
                                <Crown className="h-3 w-3 mr-1" />
                                #1
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground font-mono">
                                #{index + 1}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {result.modelId}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-semibold ${getScoreColor(
                                result.totalScore
                              )}`}
                            >
                              {result.totalScore.toFixed(1)}
                            </span>
                          </td>
                          {allCategories.map((cat) => {
                            const catScore = result.categoryBreakdown.find(
                              (c) => c.categoryName === cat
                            );
                            const score = catScore?.totalScore ?? 0;

                            return (
                              <td key={cat} className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Progress value={score} className="h-2 w-12" />
                                  <span className="w-10 text-xs text-muted-foreground">
                                    {score.toFixed(0)}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Metrics Tab */}
          <TabsContent value="detailed" className="mt-4 space-y-4">
            <ResultsClient
              sortedResults={sortedResults}
            />
          </TabsContent>

          {/* Chart Tab */}
          <TabsContent value="chart" className="mt-4">
            <PerformanceChart
              data={chartData}
              models={sortedResults.slice(0, 5).map((r) => r.modelId)}
              type="bar"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Back to History */}
      <div className="animate-fade-in">
        <Link href="/history">
          <Button variant="outline">
            <TrendingUp className="h-4 w-4 mr-2" />
            View All History
          </Button>
        </Link>
      </div>
    </div>
  );
}
