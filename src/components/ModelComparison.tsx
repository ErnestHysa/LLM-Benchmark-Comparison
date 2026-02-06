/**
 * Model Comparison Component
 *
 * Modal allowing users to select 2-3 models and compare their
 * metrics side by side. Used from the leaderboard page.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  // Guard against NaN or invalid scores
  const validScore = Number.isFinite(score) ? score : 0;
  if (validScore >= 80) return "text-success";
  if (validScore >= 60) return "text-warning";
  return "text-error";
}

function getScoreBg(score: number): string {
  // Guard against NaN or invalid scores
  const validScore = Number.isFinite(score) ? score : 0;
  if (validScore >= 80) return "bg-success/10";
  if (validScore >= 60) return "bg-warning/10";
  return "bg-error/10";
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

export function ModelComparison({ models, onClose }: ModelComparisonProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);

  // Stable close handler that checks mount state
  const handleClose = useCallback(() => {
    if (isMountedRef.current) {
      onClose();
    }
  }, [onClose]);

  // Focus trapping with proper cleanup
  useEffect(() => {
    isMountedRef.current = true;

    if (!modalRef.current) return;

    // Focus the close button when modal opens
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    // Trap focus within modal
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift+Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          (lastElement as HTMLElement)?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          (firstElement as HTMLElement)?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    modalRef.current?.addEventListener("keydown", handleTab);

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      // Mark as unmounted first to prevent state updates
      isMountedRef.current = false;

      document.removeEventListener("keydown", handleEscape);
      if (modalRef.current) {
        modalRef.current.removeEventListener("keydown", handleTab);
      }
      document.body.style.overflow = originalOverflow;
    };
  }, [handleClose]);

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
    createPortal(
      <div
        ref={modalRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-comparison-title"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={handleClose}
          aria-label="Close modal"
        />
        {/* Modal */}
        <Card className="relative z-50 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
        <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 shrink-0">
          <CardTitle id="model-comparison-title" className="text-xl">Compare Models</CardTitle>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="shrink-0"
            aria-label="Close comparison modal"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Model Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Select 2-3 models to compare ({selectedModels.length}/3 selected)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2">
              {models.map((model) => {
                const isSelected = selectedModels.includes(model.modelId);
                const isDisabled = !isSelected && selectedModels.length >= 3;

                return (
                  <label
                    key={model.modelId}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : isDisabled
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "border-border hover:border-primary/50 hover:bg-surface-hover"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleModel(model.modelId)}
                      disabled={isDisabled}
                      className="shrink-0"
                    />
                    <span className="text-sm font-medium truncate flex-1">{model.modelId}</span>
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
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">
                        Metric
                      </th>
                      {comparisonData.map((m) => (
                        <th
                          key={m.modelId}
                          className="text-center py-3 px-4 text-sm font-semibold text-foreground min-w-[120px]"
                        >
                          <div className="flex items-center justify-center gap-2">
                            {m.avgScore === bestScore && (
                              <Crown className="h-4 w-4 text-primary shrink-0" />
                            )}
                            <span className="truncate max-w-[150px] block">{m.modelId}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Average Score */}
                    <tr className="border-b border-border/50 hover:bg-surface-hover/50">
                      <td className="py-4 px-4 font-medium text-sm">Average Score</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span
                              className={`text-2xl font-bold ${getScoreColor(m.avgScore)}`}
                            >
                              {safeScoreDisplay(m.avgScore)}
                            </span>
                            {safeScoreValue(m.avgScore) === safeScoreValue(bestScore) && (
                              <Badge className="bg-primary text-primary-fg text-xs">Best</Badge>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Score Bar */}
                    <tr className="border-b border-border/50 hover:bg-surface-hover/50">
                      <td className="py-4 px-4 font-medium text-sm">Performance</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="py-4 px-4">
                          <div className="space-y-1">
                            <Progress value={clampScore(m.avgScore)} className="h-3" />
                            <span className="text-xs text-muted-foreground text-center block">
                              {safeScoreDisplay(m.avgScore, 0)}%
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Run Count */}
                    <tr className="border-b border-border/50 hover:bg-surface-hover/50">
                      <td className="py-4 px-4 font-medium text-sm">Benchmark Runs</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="py-4 px-4 text-center">
                          <span className="text-sm text-muted-foreground">{m.runCount} runs</span>
                        </td>
                      ))}
                    </tr>

                    {/* Score Tier */}
                    <tr className="border-b border-border/50 hover:bg-surface-hover/50">
                      <td className="py-4 px-4 font-medium text-sm">Score Tier</td>
                      {comparisonData.map((m) => (
                        <td key={m.modelId} className="py-4 px-4 text-center">
                          <Badge variant="outline" className={`${getScoreBg(m.avgScore)} text-sm`}>
                            {safeScoreValue(m.avgScore) >= 80
                              ? "Excellent"
                              : safeScoreValue(m.avgScore) >= 60
                              ? "Good"
                              : "Needs Improvement"}
                          </Badge>
                        </td>
                      ))}
                    </tr>

                    {/* Score Difference */}
                    {comparisonData.length === 2 && (
                      <tr className="hover:bg-surface-hover/50">
                        <td className="py-4 px-4 font-medium text-sm">Difference</td>
                        <td colSpan={2} className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                              {safeScoreDisplay(Math.abs(
                                (safeScoreValue(comparisonData[0]?.avgScore) ?? 0) -
                                  (safeScoreValue(comparisonData[1]?.avgScore) ?? 0)
                              ))}{" "}
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
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Select at least 2 models to see the comparison.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>,
      document.body
    )
  );
}
