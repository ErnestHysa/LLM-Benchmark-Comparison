/**
 * Model Comparison Component
 *
 * Modal allowing users to select 2-3 models and compare their
 * metrics side by side. Used from the leaderboard page.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { X, Crown, TrendingUp } from "lucide-react";

interface ModelEntry {
  modelId: string;
  avgScore: number;
  runCount: number;
}

interface ModelComparisonProps {
  models: ModelEntry[];
  onClose: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-error";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-success/10";
  if (score >= 60) return "bg-warning/10";
  return "bg-error/10";
}

export function ModelComparison({ models, onClose }: ModelComparisonProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels((prev) => prev.filter((id) => id !== modelId));
    } else if (selectedModels.length < 3) {
      setSelectedModels((prev) => [...prev, modelId]);
    }
  };

  const comparisonData = selectedModels
    .map((id) => models.find((m) => m.modelId === id))
    .filter((m): m is ModelEntry => m !== undefined);

  const bestScore = comparisonData.length > 0
    ? Math.max(...comparisonData.map((m) => m.avgScore))
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[85vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-background z-10 border-b border-border">
          <CardTitle className="text-xl">Compare Models</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Model Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Select 2-3 models to compare (
              {selectedModels.length}/3 selected)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {models.map((model) => {
                const isSelected = selectedModels.includes(model.modelId);
                const isDisabled = !isSelected && selectedModels.length >= 3;

                return (
                  <label
                    key={model.modelId}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : isDisabled
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "border-border hover:bg-surface-hover"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleModel(model.modelId)}
                      disabled={isDisabled}
                    />
                    <span className="text-sm truncate">{model.modelId}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Comparison Table */}
          {comparisonData.length >= 2 && (
            <div className="animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                        Metric
                      </th>
                      {comparisonData.map((m) => (
                        <th
                          key={m.modelId}
                          className="text-left p-3 text-sm font-medium text-foreground"
                        >
                          <div className="flex items-center gap-1">
                            {m.avgScore === bestScore && (
                              <Crown className="h-4 w-4 text-primary" />
                            )}
                            <span className="truncate">{m.modelId}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Average Score */}
                    <tr className="border-b border-border/50">
                      <td className="p-3 font-medium text-sm">Average Score</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="p-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-lg font-bold ${getScoreColor(
                                m.avgScore
                              )}`}
                            >
                              {m.avgScore.toFixed(1)}
                            </span>
                            {m.avgScore === bestScore && (
                              <Badge className="bg-primary text-primary-fg text-xs">
                                Best
                              </Badge>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Score Bar */}
                    <tr className="border-b border-border/50">
                      <td className="p-3 font-medium text-sm">Performance</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="p-3">
                          <div className="flex items-center gap-2">
                            <Progress value={m.avgScore} className="h-3 flex-1" />
                            <span className="text-xs text-muted-foreground w-10 text-right">
                              {m.avgScore.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Run Count */}
                    <tr className="border-b border-border/50">
                      <td className="p-3 font-medium text-sm">Benchmark Runs</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="p-3">
                          <span className="text-sm text-muted-foreground">
                            {m.runCount} runs
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Score Tier */}
                    <tr className="border-b border-border/50">
                      <td className="p-3 font-medium text-sm">Score Tier</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="p-3">
                          <Badge
                            variant="outline"
                            className={getScoreBg(m.avgScore)}
                          >
                            {m.avgScore >= 80
                              ? "Excellent"
                              : m.avgScore >= 60
                              ? "Good"
                              : "Needs Improvement"}
                          </Badge>
                        </td>
                      ))}
                    </tr>

                    {/* Score Difference */}
                    {comparisonData.length === 2 && (
                      <tr className="border-b border-border/50">
                        <td className="p-3 font-medium text-sm">Difference</td>
                        <td colSpan={2} className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                              {Math.abs(
                                (comparisonData[0]?.avgScore ?? 0) -
                                  (comparisonData[1]?.avgScore ?? 0)
                              ).toFixed(1)}{" "}
                              points difference
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hint when less than 2 selected */}
          {comparisonData.length < 2 && (
            <p className="text-center text-muted-foreground py-8">
              Select at least 2 models to see the comparison.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
