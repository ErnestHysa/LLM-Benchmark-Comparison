/**
 * Results Client Component
 *
 * Client-side features for the results page including View Output modal
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Crown, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import { ModelOutputModal } from "./ModelOutputModal";
import type { ModelResult } from "@/app/results/[id]/page";

interface MetricExplanation {
  metricName: string;
  explanation: string | null;
  value: number;
}

interface Metric {
  category: string;
  metricName: string;
  score: number;
  weight: number;
  confidence: number | null;
  explanations: MetricExplanation[];
}

interface ModelResultWithMetrics extends ModelResult {
  metrics?: Metric[];
}

interface ResultsClientProps {
  sortedResults: ModelResultWithMetrics[];
}

function getScoreColor(score: number): string {
  // Guard against NaN or invalid scores
  const validScore = Number.isFinite(score) ? score : 0;
  if (validScore >= 80) return "text-success";
  if (validScore >= 60) return "text-warning";
  return "text-error";
}

function getScoreBgColor(score: number): string {
  // Guard against NaN or invalid scores
  const validScore = Number.isFinite(score) ? score : 0;
  if (validScore >= 80) return "bg-success/10 border-success/30 text-success";
  if (validScore >= 60) return "bg-warning/10 border-warning/30 text-warning";
  return "bg-error/10 border-error/30 text-error";
}

function getScoreNumberBg(score: number): string {
  // Guard against NaN or invalid scores
  const validScore = Number.isFinite(score) ? score : 0;
  if (validScore >= 80) return "bg-success text-success-foreground";
  if (validScore >= 60) return "bg-warning text-warning-foreground";
  return "bg-error text-error-foreground";
}

// Category colors for visual distinction
const categoryColors: Record<string, string> = {
  CODING: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  WRITING: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
  REASONING: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  DEBUGGING: "from-red-500/20 to-red-600/5 border-red-500/30",
  "API_DESIGN": "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
  "DATABASE_SCHEMA": "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30",
  "UI_UX_DESIGN": "from-pink-500/20 to-pink-600/5 border-pink-500/30",
  "DATA_ANALYSIS": "from-orange-500/20 to-orange-600/5 border-orange-500/30",
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || "from-gray-500/20 to-gray-600/5 border-gray-500/30";
}

// Safe score utilities - protect against NaN/undefined/null values
function safeScoreValue(score: number | undefined | null): number {
  return Number.isFinite(score ?? 0) ? (score ?? 0) : 0;
}

function safeScoreDisplay(score: number | undefined | null, decimals: number = 1): string {
  const validScore = safeScoreValue(score ?? 0);
  return validScore.toFixed(decimals);
}

function clampScore(score: number): number {
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, safeScoreValue(score)));
}

// Metric Explanations Component
function MetricExplanations({ metrics }: { metrics: Metric[] }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!metrics || metrics.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No detailed explanations available for this model run.
      </div>
    );
  }

  // Group explanations by category
  const byCategory = metrics.reduce((acc, metric) => {
    const category = metric.category;
    if (!category) return acc;

    if (!acc[category]) {
      acc[category] = [];
    }
    if (metric.explanations && metric.explanations.length > 0) {
      acc[category].push(metric);
    }
    return acc;
  }, {} as Record<string, Metric[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="h-4 w-4" />
        <span>AI-generated explanations for each score</span>
      </div>

      {Object.entries(byCategory).map(([category, categoryMetrics], catIndex) => {
        const hasExplanations = categoryMetrics.some((m) => m.explanations.length > 0);
        if (!hasExplanations) return null;

        const isExpanded = expandedCategories.has(category);
        const colorClass = getCategoryColor(category);

        return (
          <div
            key={category}
            className={`border rounded-xl overflow-hidden bg-gradient-to-br ${colorClass}`}
          >
            <button
              onClick={() => toggleCategory(category)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-white/10 text-xs font-bold">
                  {catIndex + 1}
                </span>
                <span className="font-semibold text-foreground">{category.replace("_", " ")}</span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 bg-black/20">
                {categoryMetrics.map((metric, idx) => (
                  metric.explanations.map((explanation, expIdx) => {
                    const scoreValue = safeScoreValue(explanation.value);
                    return (
                      <div
                        key={`${idx}-${expIdx}`}
                        className={`rounded-lg p-4 text-sm border backdrop-blur-sm ${getScoreBgColor(scoreValue)}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="font-semibold text-foreground flex-1">
                            {explanation.metricName}
                          </span>
                          <div className={`flex items-center justify-center h-8 w-12 rounded-lg ${getScoreNumberBg(scoreValue)} font-bold text-lg shadow-sm`}>
                            {safeScoreDisplay(scoreValue, 0)}
                          </div>
                        </div>
                        <div className="h-px bg-white/10 my-2" />
                        <p className="text-foreground/80 leading-relaxed">
                          {explanation.explanation}
                        </p>
                      </div>
                    );
                  })
                ))}
              </div>
            )}
          </div>
        );
      })}

      {!Object.entries(byCategory).some(([_, metrics]) => metrics.some((m) => m.explanations.length > 0)) && (
        <div className="text-sm text-muted-foreground text-center py-4">
          No explanations available for this run.
        </div>
      )}
    </div>
  );
}

export function ResultsClient({
  sortedResults,
}: ResultsClientProps) {
  const [selectedModel, setSelectedModel] = useState<{
    modelId: string;
    output: string;
    status: string;
    error?: string;
  } | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleViewOutput = (result: ModelResult) => {
    if (!isMountedRef.current) return;
    setSelectedModel({
      modelId: result.modelId,
      output: result.output || "",
      status: result.status,
      error: result.error,
    });
  };

  return (
    <>
      {sortedResults.map((result, index) => (
        <Card key={result.modelRunId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {index === 0 && <Crown className="h-5 w-5 text-primary" />}
                <CardTitle className="text-xl">{result.modelId}</CardTitle>
                <Badge
                  variant="outline"
                  className={getScoreColor(result.totalScore)}
                >
                  {safeScoreDisplay(result.totalScore)}%
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    result.status === "FAILED"
                      ? "bg-error/10 text-error border-error/20"
                      : result.status === "COMPLETED"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-warning/10 text-warning border-warning/20"
                  }
                >
                  {result.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  Rank #{index + 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewOutput(result)}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  View Output
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.categoryBreakdown.map((category) => (
                <div
                  key={category.categoryId}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-foreground">
                      {category.categoryName}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Progress value={clampScore(category.totalScore)} className="h-2 w-20" />
                      <span
                        className={`text-sm font-medium ${getScoreColor(
                          category.totalScore
                        )}`}
                      >
                        {safeScoreDisplay(category.totalScore)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Metric Explanations Section */}
              {(result.metrics && result.metrics.length > 0) && (
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    AI Explanations
                  </h4>
                  <MetricExplanations metrics={result.metrics} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Model Output Modal */}
      {selectedModel && (
        <ModelOutputModal
          open={!!selectedModel}
          onOpenChange={(open) => !open && setSelectedModel(null)}
          modelId={selectedModel.modelId}
          output={selectedModel.output}
          status={selectedModel.status}
          error={selectedModel.error}
        />
      )}
    </>
  );
}
