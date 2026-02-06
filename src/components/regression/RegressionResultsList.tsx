/**
 * RegressionResultsList Component
 *
 * Displays recent regression test runs with detailed results
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface ModelRunResult {
  modelId: string;
  totalScore: number;
  previousScore: number | null;
  scoreDiff: number | null;
  status: string;
}

interface RegressionRun {
  id: string;
  status: string;
  totalScore: number | null;
  previousScore: number | null;
  scoreDiff: number | null;
  isRegression: boolean;
  startedAt: Date;
  baseline: {
    id: string;
    name: string;
  };
  modelRuns: ModelRunResult[];
}

interface RegressionResultsListProps {
  runs: RegressionRun[];
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

function getRunStatusIcon(status: string, isRegression: boolean) {
  if (status === "FAILED") {
    return <XCircle className="h-5 w-5 text-error" />;
  }
  if (isRegression) {
    return <TrendingDown className="h-5 w-5 text-error" />;
  }
  if (status === "COMPLETED") {
    return <CheckCircle2 className="h-5 w-5 text-success" />;
  }
  if (status === "RUNNING") {
    return <Clock className="h-5 w-5 text-warning animate-pulse" />;
  }
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

export function RegressionResultsList({ runs }: RegressionResultsListProps) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No regression runs yet.</p>
          <p className="text-sm mt-2">Run a baseline to see results here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => {
        const scoreDiffPercent = run.previousScore
          ? ((run.scoreDiff || 0) / run.previousScore) * 100
          : 0;

        return (
          <Card key={run.id} className={run.isRegression ? "border-error/50" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getRunStatusIcon(run.status, run.isRegression)}
                  <div>
                    <CardTitle className="text-lg">{run.baseline.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    run.status === "COMPLETED"
                      ? "bg-success/10 text-success border-success/20"
                      : run.status === "REGRESSED"
                        ? "bg-error/10 text-error border-error/20"
                        : run.status === "FAILED"
                          ? "bg-error/10 text-error border-error/20"
                          : "bg-warning/10 text-warning border-warning/20"
                  }
                >
                  {run.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Overall Score */}
              {run.totalScore !== null && (
                <div className="mb-4 p-4 bg-surface rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Score</span>
                    <div className="flex items-center gap-2">
                      {run.previousScore !== null && (
                        <span className="text-xs text-muted-foreground">
                          Prev: {run.previousScore.toFixed(1)}
                        </span>
                      )}
                      {run.scoreDiff !== null && run.scoreDiff !== 0 && (
                        <span
                          className={`text-xs font-medium ${
                            run.scoreDiff > 0 ? "text-success" : "text-error"
                          }`}
                        >
                          {run.scoreDiff > 0 ? "+" : ""}
                          {run.scoreDiff.toFixed(1)}
                          ({scoreDiffPercent.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={run.totalScore}
                      className="flex-1 h-3"
                    />
                    <span
                      className={`text-2xl font-bold ${getScoreColor(
                        run.totalScore,
                        run.previousScore
                      )}`}
                    >
                      {run.totalScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}

              {/* Model Results */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Model Results</h4>
                {run.modelRuns.map((modelRun) => (
                  <div
                    key={modelRun.modelId}
                    className="flex items-center justify-between p-3 bg-surface rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {modelRun.modelId}
                        </span>
                        {modelRun.status === "FAILED" && (
                          <Badge variant="outline" className="bg-error/10 text-error border-error/20 text-xs">
                            Failed
                          </Badge>
                        )}
                      </div>
                      {modelRun.previousScore !== null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>Prev: {modelRun.previousScore.toFixed(1)}</span>
                          {modelRun.scoreDiff !== null && (
                            <span
                              className={
                                modelRun.scoreDiff > 0
                                  ? "text-success"
                                  : modelRun.scoreDiff < 0
                                  ? "text-error"
                                  : ""
                              }
                            >
                              {modelRun.scoreDiff > 0 ? "+" : ""}
                              {modelRun.scoreDiff.toFixed(1)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {modelRun.status !== "FAILED" && (
                      <div className="flex items-center gap-2">
                        <Progress value={modelRun.totalScore} className="w-24 h-2" />
                        <span
                          className={`text-sm font-semibold ${getScoreColor(
                            modelRun.totalScore,
                            modelRun.previousScore
                          )}`}
                        >
                          {modelRun.totalScore.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// For the empty state icon
function BarChart3(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}
