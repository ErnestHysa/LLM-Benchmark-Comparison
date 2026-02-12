/**
 * Trend Chart Component
 *
 * Line chart showing performance trends over time
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleLineChart } from '@/components/ui/charts';

interface TrendData {
  scores: {
    dates: string[];
    models: Array<{
      modelId: string;
      modelName: string;
      data: number[];
    }>;
  };
}

interface TrendChartProps {
  benchmarkId?: string;
  modelIds?: string[];
  period: '7d' | '30d' | '90d' | 'all';
}

export function TrendChart({ benchmarkId, modelIds, period }: TrendChartProps) {
  const [data, setData] = useState<TrendData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      benchmarkId: benchmarkId || '',
      models: modelIds?.join(',') || '',
      period,
    });

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analytics/trends?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch trend data');
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
  }, [benchmarkId, modelIds, period]);

  const chartData = useMemo(() => {
    if (!data || error) return [];

    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // rose
      '#8b5cf6', // cyan
      '#f97316', // pink
      '#a855f7', // violet
      '#06b6d4', // indigo
    ];

    // Create datasets for each model
    const datasets = data.scores.models.map((model, index) => ({
      label: model.modelName,
      data: model.data,
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
    }));

    return {
      labels: data.scores.dates,
      datasets,
    };
  }, [data, error]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load trend data</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const periodLabels: Record<typeof period, string> = {
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
    'all': 'All time',
  };
  const periodLabel = periodLabels[period];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Performance Trends</CardTitle>
        <div className="text-sm text-muted-foreground">
          {period === 'all' ? 'All data' : `Last ${periodLabel}`}
        </div>
      </CardHeader>
      <CardContent>
        <SimpleLineChart
          data={chartData}
          height={300}
        />
      </CardContent>
    </Card>
  );
}
