"use client";

/**
 * Benchmark Card Component
 *
 * Card for displaying a benchmark with run button
 */

import Link from "next/link";
import { Play, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface BenchmarkCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  runCount: number;
  avgScore?: number | null;
  className?: string;
  index?: number;
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

export function BenchmarkCard({
  id,
  name,
  description,
  category,
  runCount,
  avgScore,
  className,
  index = 0,
}: BenchmarkCardProps) {
  const categoryColor = categoryColors[category] || categoryColors.CODING;
  const displayCategory = category.replace("_", " ");
  // Add staggered animation delay based on index
  const delayClass = index ? `delay-${Math.min(index * 50, 500)}` : "";

  return (
    <div className={cn("animate-fade-in-up", delayClass)}>
      <Card className={cn("card-hover group h-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className={cn("mb-2", categoryColor)}>
                {displayCategory}
              </Badge>
              <CardTitle className="line-clamp-1 text-lg">{name}</CardTitle>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{runCount} runs</span>
              {avgScore !== null && avgScore !== undefined && (
                <span className={cn(
                  "font-medium",
                  avgScore >= 80 ? "text-success" :
                  avgScore >= 60 ? "text-primary" :
                  avgScore >= 40 ? "text-warning" : "text-error"
                )}>
                  {avgScore.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/benchmarks/${id}`} aria-label={`View ${name} details`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
                  aria-label="View"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/benchmarks/${id}/run`}>
                <Button
                  size="sm"
                  className="h-8 px-3"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Run
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
