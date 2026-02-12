/**
 * Heatmap Component
 *
 * Color-coded matrix showing model vs benchmark performance
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { CellHeader } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HeatmapData {
  models: string[];
  benchmarks: Array<{
    id: string;
    name: string;
    primaryCategory: string;
  }>;
  scores: Array<Array<number | null>>; // [score_for_benchmark1, score_for_benchmark2, ...]
}

interface HeatmapProps {
  period?: '7d' | '30d' | '90d' | 'all';
}

// Color scale for scores (0 = red, 100 = green)
function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-muted';
  if (score >= 90) return 'bg-green-500 text-white';
  if (score >= 75) return 'bg-green-600 text-white';
  if (score >= 60) return 'bg-yellow-500 text-white';
  if (score >= 40) return 'bg-orange-500 text-white';
  if (score >= 20) return 'bg-orange-600 text-white';
  return 'bg-red-500 text-white';
}

// Score badge display
function getScoreBadge(score: number | null): React.ReactNode {
  if (score === null) return <span className="text-muted-foreground">-</span>;
  if (score >= 90) return <Badge variant="default">Excellent</Badge>;
  if (score >= 75) return <Badge variant="secondary">Good</Badge>;
  if (score >= 60) return <Badge variant="outline">Fair</Badge>;
  if (score >= 40) return <Badge variant="destructive">Poor</Badge>;
  return <Badge variant="destructive">Very Poor</Badge>;
}

export function Heatmap({ period = '30d' }: HeatmapProps) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analytics/trends?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch heatmap data');
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [period]);

  const cellData = useMemo(() => {
    if (!data || error) return [];

    return data.scores.map((row) => row.map((score) => ({
      score,
      color: getScoreColor(score),
      badge: getScoreBadge(score),
    })));
  }, [data, error]);

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Heatmap</h3>
        <p className="text-destructive">Failed to load heatmap data</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Heatmap</h3>
        <p className="text-center text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Heatmap</h3>
        <p className="text-center text-muted-foreground">No data available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Model vs Benchmark Performance</h3>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header row with benchmark names */}
          <div className="flex border-b border-border mb-2">
            <div className="w-32 flex-shrink-0 font-semibold text-sm p-2">
              Model
            </div>
            {data.benchmarks.map((b) => (
              <CellHeader key={b.id} className="w-24 flex-shrink-0">
                {b.name}
              </CellHeader>
            ))}
          </div>

          {/* Data rows */}
          {cellData.map((row, rowIndex) => (
            <div key={rowIndex} className="flex border-b border-border">
              <div className="w-32 flex-shrink-0 font-medium text-sm p-2 border-r border-border">
                {data.models[rowIndex]}
              </div>
              {row.map((cell, cellIndex) => (
                <div
                  key={cellIndex}
                  className={cn(
                    'w-24 h-12 flex-shrink-0 flex items-center justify-center text-sm font-mono',
                    cell.color
                  )}
                >
                  {cell.score !== null ? cell.score.toFixed(1) : '-'}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span>Excellent (&ge;90)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-600 rounded" />
          <span>Good (75-89)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-500 rounded" />
          <span>Fair (60-74)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-orange-500 rounded" />
          <span>Poor (40-59)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span>Very Poor (&lt;40)</span>
        </div>
      </div>
    </Card>
  );
}
