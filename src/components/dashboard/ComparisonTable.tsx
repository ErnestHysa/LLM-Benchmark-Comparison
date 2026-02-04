"use client";

/**
 * Comparison Table Component
 *
 * Table comparing model scores side by side
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ModelResult {
  modelId: string;
  modelName: string;
  totalScore: number;
  rank?: number;
  categoryScores: Array<{
    category: string;
    score: number;
  }>;
}

interface ComparisonTableProps {
  results: ModelResult[];
  className?: string;
}

export function ComparisonTable({ results, className }: ComparisonTableProps) {
  if (results.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center text-muted-foreground">
          No results to display yet. Run a benchmark to see comparisons.
        </CardContent>
      </Card>
    );
  }

  // Get all unique categories
  const categories = Array.from(
    new Set(results.flatMap((r) => r.categoryScores.map((c) => c.category)))
  );

  // Sort results by total score
  const sortedResults = [...results].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Model Comparison</CardTitle>
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
                {categories.map((cat) => (
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
                <tr key={result.modelId} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors duration-fast">
                  <td className="py-3 px-4">
                    {index < 3 ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono",
                          index === 0 && "border-primary text-primary bg-primary/10",
                          index === 1 && "border-muted-foreground text-muted-foreground bg-muted/10",
                          index === 2 && "border-warning text-warning bg-warning/10"
                        )}
                      >
                        #{index + 1}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground font-mono">#{index + 1}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium">{result.modelName}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={cn(
                        "font-semibold",
                        result.totalScore >= 80 ? "text-success" :
                        result.totalScore >= 60 ? "text-primary" :
                        result.totalScore >= 40 ? "text-warning" : "text-error"
                      )}
                    >
                      {result.totalScore.toFixed(1)}
                    </span>
                  </td>
                  {categories.map((cat) => {
                    const catScore = result.categoryScores.find((c) => c.category === cat);
                    const score = catScore?.score ?? 0;

                    return (
                      <td key={cat} className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress
                            value={score}
                            max={100}
                            className="h-2 w-16"
                          />
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
  );
}
