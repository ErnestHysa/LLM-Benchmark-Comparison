/**
 * Regression Testing Page
 *
 * Create and manage regression baselines, view test results,
 * and track model performance over time
 */

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  TrendingDown,
  Clock,
  BarChart3,
  Settings,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout";
import { CreateBaselineDialog } from "@/components/regression/CreateBaselineDialog";
import { RegressionResultsList } from "@/components/regression/RegressionResultsList";
import { AlertsPanel } from "@/components/regression/AlertsPanel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regression Testing - LLM Benchmark",
  description: "Automated regression testing for LLM models - track performance over time",
};

interface RegressionPageProps {
  searchParams: Promise<{ tab?: string }>;
}

async function getRegressionData() {
  // Get all baselines with latest run info
  const baselines = await prisma.regressionBaseline.findMany({
    where: { isActive: true },
    include: {
      benchmark: {
        select: {
          id: true,
          name: true,
          primaryCategory: true,
        },
      },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          totalScore: true,
          isRegression: true,
          startedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get recent runs
  const recentRuns = await prisma.regressionRun.findMany({
    include: {
      baseline: {
        select: {
          id: true,
          name: true,
        },
      },
      modelRuns: {
        select: {
          modelId: true,
          totalScore: true,
          previousScore: true,
          scoreDiff: true,
          status: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  // Get unacknowledged alerts
  const alerts = await prisma.regressionAlert.findMany({
    where: { acknowledged: false },
    include: {
      regressionRun: {
        select: {
          id: true,
          totalScore: true,
          previousScore: true,
          startedAt: true,
          baseline: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    baselines: baselines.map((b) => ({
      ...b,
      modelIds: JSON.parse(b.modelIds),
      scheduleConfig: b.scheduleConfig ? JSON.parse(b.scheduleConfig) : null,
    })),
    recentRuns,
    alerts,
  };
}

function getScoreColor(score: number, previousScore?: number | null): string {
  if (previousScore !== null && previousScore !== undefined) {
    const diff = score - previousScore;
    if (diff > 5) return "text-success";
    if (diff < -5) return "text-error";
  }
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-error";
}

function getRunStatusColor(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-success/10 text-success border-success/20";
    case "REGRESSED":
      return "bg-error/10 text-error border-error/20";
    case "FAILED":
      return "bg-error/10 text-error border-error/20";
    case "RUNNING":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default async function RegressionPage({
  searchParams,
}: RegressionPageProps) {
  const params = await searchParams;
  const activeTab = params.tab || "baselines";

  const data = await getRegressionData();

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Regression Testing" },
  ];

  // Calculate stats
  const totalBaselines = data.baselines.length;
  const activeBaselines = data.baselines.filter((b) => b.isActive).length;
  const regressedRuns = data.recentRuns.filter((r) => r.isRegression).length;
  const unacknowledgedAlerts = data.alerts.length;

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
            <h1 className="text-3xl font-bold text-foreground">Regression Testing</h1>
            <p className="text-muted-foreground mt-2">
              Automated testing to track model performance over time and detect regressions
            </p>
          </div>
          <CreateBaselineDialog />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up delay-100">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Baselines</p>
                <p className="text-2xl font-bold text-foreground mt-1">{activeBaselines}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Baselines</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totalBaselines}</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Regressions</p>
                <p className="text-2xl font-bold text-error mt-1">{regressedRuns}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-error" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Alerts</p>
                <p className="text-2xl font-bold text-warning mt-1">{unacknowledgedAlerts}</p>
              </div>
              <Bell className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up delay-200">
        <Tabs defaultValue={activeTab} className="space-y-4">
          <TabsList className="bg-surface border border-border p-1 rounded-lg">
            <TabsTrigger value="baselines" asChild>
              <Link href="/regression?tab=baselines" className="px-4 py-2 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Baselines
              </Link>
            </TabsTrigger>
            <TabsTrigger value="results" asChild>
              <Link href="/regression?tab=results" className="px-4 py-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Results
              </Link>
            </TabsTrigger>
            <TabsTrigger value="alerts" asChild>
              <Link href="/regression?tab=alerts" className="px-4 py-2 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alerts
                {unacknowledgedAlerts > 0 && (
                  <Badge className="bg-warning text-warning-foreground text-xs">
                    {unacknowledgedAlerts}
                  </Badge>
                )}
              </Link>
            </TabsTrigger>
          </TabsList>

          {/* Baselines Tab */}
          <TabsContent value="baselines" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Regression Baselines</CardTitle>
              </CardHeader>
              <CardContent>
                {data.baselines.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No baselines yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Create your first regression baseline to start tracking model performance
                    </p>
                    <CreateBaselineDialog />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.baselines.map((baseline) => (
                      <BaselineCard
                        key={baseline.id}
                        baseline={baseline}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-4">
            <RegressionResultsList runs={data.recentRuns} />
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-4">
            <AlertsPanel alerts={data.alerts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface BaselineCardProps {
  baseline: {
    id: string;
    name: string;
    description: string | null;
    benchmarkId: string;
    benchmark: {
      id: string;
      name: string;
      primaryCategory: string;
    };
    modelIds: string[];
    evaluator: string;
    thresholdMin: number | null;
    thresholdMax: number | null;
    regressionDelta: number | null;
    scheduleType: string;
    lastRunAt: Date | null;
    lastStatus: string | null;
    runs: Array<{
      id: string;
      status: string;
      totalScore: number | null;
      isRegression: boolean;
      startedAt: Date;
    }>;
  };
}

function BaselineCard({ baseline }: BaselineCardProps) {
  const latestRun = baseline.runs[0];

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-foreground">{baseline.name}</h3>
              {baseline.scheduleType === "manual" ? (
                <Badge variant="outline" className="text-xs">
                  Manual
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  Auto
                </Badge>
              )}
            </div>

            {baseline.description && (
              <p className="text-sm text-muted-foreground mb-3">{baseline.description}</p>
            )}

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-4">
              <span>Benchmark: {baseline.benchmark.name}</span>
              <span>•</span>
              <span>Models: {baseline.modelIds.join(", ")}</span>
              <span>•</span>
              <span>Evaluator: {baseline.evaluator}</span>
            </div>

            {/* Thresholds */}
            {(baseline.thresholdMin !== null || baseline.thresholdMax !== null || baseline.regressionDelta !== null) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {baseline.thresholdMin !== null && (
                  <Badge variant="outline" className="text-xs">
                    Min: {baseline.thresholdMin}
                  </Badge>
                )}
                {baseline.thresholdMax !== null && (
                  <Badge variant="outline" className="text-xs">
                    Max: {baseline.thresholdMax}
                  </Badge>
                )}
                {baseline.regressionDelta !== null && (
                  <Badge variant="outline" className="text-xs text-warning">
                    Alert if drop &gt; {baseline.regressionDelta}%
                  </Badge>
                )}
              </div>
            )}

            {/* Last run info */}
            {latestRun ? (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Last run: {latestRun.startedAt.toLocaleDateString()}
                  </span>
                </div>
                <Badge className={getRunStatusColor(latestRun.status)}>
                  {latestRun.status}
                </Badge>
                {latestRun.totalScore !== null && (
                  <span className={getScoreColor(latestRun.totalScore)}>
                    {latestRun.totalScore.toFixed(1)}%
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Never run</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Trigger run
                fetch(`/api/baselines/${baseline.id}/run`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                }).then(() => {
                  window.location.reload();
                });
              }}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Run Now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <Link href={`/regression/baselines/${baseline.id}`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
