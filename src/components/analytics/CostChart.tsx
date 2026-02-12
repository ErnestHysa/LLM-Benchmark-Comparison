/**
 * Cost Chart Component
 *
 * Bar chart showing cost breakdown by provider
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleBarChart } from '@/components/ui/charts';
import { DollarSign } from 'lucide-react';

interface CostData {
  total: number;
  byProvider: Array<{
    provider: string;
    totalCost: number;
    runCount: number;
    avgCost: number;
    percentage: number;
  }>;
}

interface CostChartProps {
  period: '7d' | '30d' | '90d' | 'all';
  periodStart?: string;
  periodEnd?: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97706',
  openrouter: '#8b5cf6',
  custom: '#6366f1',
};

export function CostChart({ period, periodStart, periodEnd }: CostChartProps) {
  const [data, setData] = useState<CostData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      period,
      periodStart: periodStart || '',
      periodEnd: periodEnd || '',
    });

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analytics/costs?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch cost data');
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
  }, [period, periodStart, periodEnd]);

  const chartData = useMemo(() => {
    if (!data || error) return { labels: [], datasets: [] };

    const labels = data.byProvider.map((p) => {
      // Capitalize provider name
      const provider = p.provider.charAt(0).toUpperCase() + p.provider.slice(1);
      return provider;
    });

    const costs = data.byProvider.map((p) => p.totalCost);
    const colors = data.byProvider.map((p) => PROVIDER_COLORS[p.provider] || '#64748b');

    return {
      labels,
      datasets: [{
        label: 'Cost',
        data: costs,
        backgroundColor: colors,
      }],
    };
  }, [data, error]);

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
        <CardTitle>Cost Analysis</CardTitle>
        <div className="text-sm text-muted-foreground">
          {period === 'all' ? 'All data' : `Last ${periodLabel}`}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-destructive">Failed to load cost data</p>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${data ? `$${data.total.toFixed(2)}` : '$0.00'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
            <SimpleBarChart
              data={chartData}
              height={250}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
