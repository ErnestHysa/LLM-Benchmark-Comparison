/**
 * Benchmark Detail Page
 *
 * Full prompt display, category tags, historical runs, best/worst models
 */

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Clock, Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ScoreCard, ComparisonTable } from "@/components/dashboard";
import { Breadcrumb } from "@/components/layout";
import { CopyButton } from "@/components/ui/copy-button";

interface BenchmarkPageProps {
  params: Promise<{ id: string }>;
}

async function getBenchmark(id: string) {
  const benchmark = await prisma.benchmark.findUnique({
    where: { id },
    include: {
      categories: {
        select: { id: true, name: true, color: true },
      },
      runs: {
        take: 10,
        orderBy: { startedAt: "desc" },
        include: {
          modelRuns: {
            include: {
              categoryScores: {
                include: {
                  category: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return benchmark;
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

export default async function BenchmarkPage({ params }: BenchmarkPageProps) {
  const { id } = await params;
  const benchmark = await getBenchmark(id);

  if (!benchmark) {
    notFound();
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Benchmarks", href: "/benchmarks" },
    { label: benchmark.name },
  ];

  // Process runs to get best/worst models
  const modelRankings = new Map<string, { totalScore: number; count: number }>();

  for (const run of benchmark.runs) {
    for (const modelRun of run.modelRuns) {
      const avgScore =
        modelRun.categoryScores.length > 0
          ? modelRun.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) /
            modelRun.categoryScores.length
          : 0;

      const existing = modelRankings.get(modelRun.modelId);
      if (existing) {
        existing.totalScore += avgScore;
        existing.count += 1;
      } else {
        modelRankings.set(modelRun.modelId, { totalScore: avgScore, count: 1 });
      }
    }
  }

  const sortedModels = Array.from(modelRankings.entries())
    .map(([modelId, { totalScore, count }]) => ({
      modelId,
      avgScore: totalScore / count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const bestModel = sortedModels[0];
  const worstModel = sortedModels[sortedModels.length - 1];

  // Format results for comparison table
  const comparisonData = sortedModels.map((m) => ({
    modelId: m.modelId,
    modelName: m.modelId, // In production, would look up model name
    totalScore: m.avgScore,
    categoryScores: [], // Would need to populate
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="animate-fade-in">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Page header */}
      <div className="animate-fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={categoryColors[benchmark.primaryCategory]}>
                {benchmark.primaryCategory.replace("_", " ")}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-foreground">{benchmark.name}</h1>
            <p className="text-muted-foreground mt-2">{benchmark.description}</p>
          </div>
          <Link href={`/benchmarks/${id}/run`}>
            <Button size="lg">
              <Play className="h-4 w-4 mr-2" />
              Run Benchmark
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up delay-100">
        <Tabs defaultValue="prompt" className="space-y-4">
          <TabsList className="bg-surface border border-border p-1 rounded-lg">
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>

          {/* Prompt Tab */}
          <TabsContent value="prompt" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Benchmark Prompt</CardTitle>
                  <CopyButton text={benchmark.prompt} />
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto text-sm">
                  <code className="font-mono">{benchmark.prompt}</code>
                </pre>
              </CardContent>
            </Card>

            {/* Categories */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {benchmark.categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant="outline"
                    className={cat.color ? `border-[${cat.color}] text-[${cat.color}] bg-[${cat.color}]/10` : ""}
                  >
                    {cat.name}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            {benchmark.runs.length > 0 ? (
              <div className="space-y-4">
                {benchmark.runs.slice(0, 5).map((run) => (
                  <Card key={run.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {run.startedAt.toLocaleDateString()} at{" "}
                            {run.startedAt.toLocaleTimeString()}
                          </span>
                        </div>
                        <Badge variant="outline">{run.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {run.modelRuns.length} models tested
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No runs yet. Be the first to test this benchmark!
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="mt-4">
            {sortedModels.length > 0 ? (
              <>
                {/* Best/Worst */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {bestModel && (
                    <ScoreCard
                      title="Best Performing Model"
                      value={bestModel.modelId}
                      description={`${bestModel.avgScore.toFixed(1)}% average score`}
                      icon={<Trophy className="h-5 w-5 text-success" />}
                      color="success"
                    />
                  )}
                  {worstModel && worstModel.avgScore > 0 && (
                    <ScoreCard
                      title="Lowest Scoring Model"
                      value={worstModel.modelId}
                      description={`${worstModel.avgScore.toFixed(1)}% average score`}
                      icon={<TrendingUp className="h-5 w-5 text-error" />}
                      color="error"
                    />
                  )}
                </div>
                <ComparisonTable results={comparisonData} />
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No comparison data available yet. Run this benchmark to see model comparisons.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
