/**
 * Comparison Chart Component
 *
 * Side-by-side model comparison visualization
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleBarChart } from '@/components/ui/charts';

interface ComparisonData {
  models: Array<{
    modelId: string;
    modelName: string;
    avgScore: number;
    minScore: number;
    maxScore: number;
    runCount: number;
  }>;
}

interface ComparisonChartProps {
  benchmarkId: string;
}

export function ComparisonChart({ benchmarkId }: ComparisonChartProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analytics/trends?benchmarkId=${encodeURIComponent(benchmarkId)}&period=all`);
        if (!response.ok) {
          throw new Error('Failed to fetch comparison data');
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
  }, [benchmarkId]);

  const chartData = useMemo(() => {
    if (!data || error || !data.models) {
      return { labels: [], datasets: [] };
    }

    const labels = ['Average', 'Min', 'Max'];
    const colors = ['#3b82f6', '#10b981', '#059669'];

    const datasets = labels.map((label, labelIndex) => ({
      label,
      data: data.models.map((model) => {
        switch (label) {
          case 'Average':
            return model.avgScore;
          case 'Min':
            return model.minScore;
          case 'Max':
            return model.maxScore;
          default:
            return 0;
        }
      }),
      backgroundColor: colors[labelIndex],
    }));

    return {
      labels,
      datasets,
    };
  }, [data, error]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load comparison data</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleBarChart
          data={chartData}
          height={300}
        />
      </CardContent>
    </Card>
  );
}
