/**
 * Results Client Component
 *
 * Client-side features for the results page including View Output modal
 */

"use client";

import { useState } from "react";
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
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-error";
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
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="h-4 w-4" />
        <span>AI-generated explanations for each score</span>
      </div>

      {Object.entries(byCategory).map(([category, categoryMetrics]) => {
        const hasExplanations = categoryMetrics.some((m) => m.explanations.length > 0);
        if (!hasExplanations) return null;

        const isExpanded = expandedCategories.has(category);

        return (
          <div key={category} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover/50 transition-colors text-left"
            >
              <span className="font-medium text-foreground">{category.replace("_", " ")}</span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {categoryMetrics.map((metric, idx) => (
                  metric.explanations.map((explanation, expIdx) => (
                    <div
                      key={`${idx}-${expIdx}`}
                      className="bg-surface/50 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">
                          {explanation.metricName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {explanation.value.toFixed(0)}/100
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {explanation.explanation}
                      </p>
                    </div>
                  ))
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

  const handleViewOutput = (result: ModelResult) => {
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
                  {result.totalScore.toFixed(1)}%
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
                {result.output && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewOutput(result)}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View Output
                  </Button>
                )}
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
                      <Progress value={category.totalScore} className="h-2 w-20" />
                      <span
                        className={`text-sm font-medium ${getScoreColor(
                          category.totalScore
                        )}`}
                      >
                        {category.totalScore.toFixed(1)}%
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
