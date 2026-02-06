/**
 * AnalyticsDashboard Component
 *
 * Client component for displaying statistical analysis
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Brain,
  RefreshCw,
  DollarSign,
  Zap,
  Target,
  Minus,
  ChevronRight,
} from "lucide-react";

interface Model {
  modelId: string;
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  confidenceInterval: { lower: number; upper: number };
  outliers: number[];
  outlierCount: number;
  trend: {
    slope: number;
    direction: "improving" | "declining" | "stable";
    correlation: number;
  };
  avgCost: number;
  costPerPoint: number;
}

interface Comparison {
  modelA: string;
  modelB: string;
  meanA: number;
  meanB: number;
  zScore: number;
  pValue: number;
  significant: boolean;
  winner: string;
}

interface OverallStats {
  totalRuns: number;
  totalModels: number;
  overallMean: number;
  overallStdDev: number;
  overallMin: number;
  overallMax: number;
  overallCI: { lower: number; upper: number };
}

interface AnalyticsData {
  overall: OverallStats;
  models: Model[];
  comparisons: Comparison[];
}

interface InsightsData {
  summary: any;
  insights: {
    findings?: string[];
    trends?: string[];
    costAnalysis?: string[];
    recommendations?: string[];
    rawResponse?: string;
  };
  generatedAt: string;
}

interface AnalyticsDashboardProps {
  models: string[];
  benchmarks: Array<{ id: string; name: string }>;
}

export function AnalyticsDashboard({ models, benchmarks }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "models" | "comparisons" | "insights">("overview");

  // Use ref to track pending requests for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setError(null);
    if (!refreshing) setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedModel !== "all") params.set("modelId", selectedModel);
      if (selectedBenchmark !== "all") params.set("benchmarkId", selectedBenchmark);

      const [statsRes, insightsRes] = await Promise.all([
        fetch(`/api/statistics?${params}`, { signal: abortController.signal }),
        fetch(`/api/statistics/insights?${params}`, { signal: abortController.signal }),
      ]);

      // Handle stats response
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      } else {
        console.error("Failed to fetch statistics:", statsRes.statusText);
        setError("Failed to load statistics data");
      }

      // Handle insights response
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data);
      } else {
        // Insights failing is not critical - log but don't show error
        console.warn("Failed to fetch insights:", insightsRes.statusText);
      }

      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request was cancelled, don't show error
        return;
      }
      console.error("Error fetching analytics data:", err);
      setError("Failed to load analytics data. Please try again.");
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedModel, selectedBenchmark, refreshing]);

  useEffect(() => {
    fetchData();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-error" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case "improving": return "text-success";
      case "declining": return "text-error";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Model:</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Benchmark:</label>
              <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Benchmarks</SelectItem>
                  {benchmarks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Error Loading Analytics</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !error ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin" />
            <p>Loading analytics data...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Runs</p>
                      <p className="text-2xl font-bold">{stats.overall.totalRuns}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Target className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Score</p>
                      <p className="text-2xl font-bold">{stats.overall.overallMean.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Zap className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Models Tested</p>
                      <p className="text-2xl font-bold">{stats.overall.totalModels}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <DollarSign className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">95% CI</p>
                      <p className="text-lg font-bold">
                        {stats.overall.overallCI.lower.toFixed(1)} - {stats.overall.overallCI.upper.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-surface">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="models">Model Analysis</TabsTrigger>
              <TabsTrigger value="comparisons">Comparisons</TabsTrigger>
              <TabsTrigger value="insights">
                <Brain className="h-4 w-4 mr-2" />
                AI Insights
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {stats && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stats.models.map((model) => (
                          <div key={model.modelId} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{model.modelId}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{model.mean.toFixed(1)} avg</Badge>
                                <span className="text-muted-foreground">
                                  {model.count} runs
                                </span>
                                {getTrendIcon(model.trend.direction)}
                              </div>
                            </div>
                            <Progress value={model.mean} max={100} className="h-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>CI: {model.confidenceInterval.lower.toFixed(1)} - {model.confidenceInterval.upper.toFixed(1)}</span>
                              <span>σ: {model.stdDev.toFixed(1)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Models Tab */}
            <TabsContent value="models" className="space-y-4">
              {stats && stats.models.map((model) => (
                <Card key={model.modelId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{model.modelId}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(model.trend.direction)}
                        <Badge className={getTrendColor(model.trend.direction)}>
                          {model.trend.direction}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Mean</p>
                        <p className="text-xl font-bold">{model.mean.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Std Dev</p>
                        <p className="text-xl font-bold">{model.stdDev.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Range</p>
                        <p className="text-xl font-bold">{model.min.toFixed(0)} - {model.max.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">95% CI</p>
                        <p className="text-sm font-bold">
                          [{model.confidenceInterval.lower.toFixed(1)}, {model.confidenceInterval.upper.toFixed(1)}]
                        </p>
                      </div>
                    </div>
                    {model.outlierCount > 0 && (
                      <div className="mt-4 p-3 bg-warning/10 text-warning rounded-md flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">
                          {model.outlierCount} outlier{model.outlierCount > 1 ? "s" : ""} detected
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Comparisons Tab */}
            <TabsContent value="comparisons" className="space-y-4">
              {stats && stats.comparisons.filter(c => c.significant).map((comp, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{comp.modelA}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span className="font-medium">{comp.modelB}</span>
                      </div>
                      <Badge variant={comp.winner === comp.modelA ? "default" : "secondary"}>
                        {comp.meanA.toFixed(1)} vs {comp.meanB.toFixed(1)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Winner:</span>
                      <span className="font-medium text-success">{comp.winner}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        p-value: {comp.pValue.toFixed(4)}
                      </span>
                      <Badge variant="outline" className="ml-auto">
                        Statistically Significant
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {stats && stats.comparisons.filter(c => c.significant).length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    No statistically significant differences found between models
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-4">
              {insights && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        AI-Generated Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {insights.insights.findings && insights.insights.findings.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Key Findings</h4>
                          <ul className="space-y-2">
                            {insights.insights.findings.map((finding, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-primary">•</span>
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insights.insights.trends && insights.insights.trends.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Performance Trends</h4>
                          <ul className="space-y-2">
                            {insights.insights.trends.map((trend, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
                                {trend}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insights.insights.costAnalysis && insights.insights.costAnalysis.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Cost Analysis</h4>
                          <ul className="space-y-2">
                            {insights.insights.costAnalysis.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <DollarSign className="h-4 w-4 text-yellow-500 mt-0.5" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insights.insights.recommendations && insights.insights.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Recommendations</h4>
                          <ul className="space-y-2">
                            {insights.insights.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm p-3 bg-primary/5 rounded-md">
                                <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insights.insights.rawResponse && !insights.insights.findings && (
                        <div>
                          <h4 className="font-semibold mb-3">Analysis</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {insights.insights.rawResponse}
                          </p>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground pt-4 border-t">
                        Generated at {new Date(insights.generatedAt).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
