/**
 * Dashboard Overview Component
 *
 * Overview cards showing key metrics
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle, XCircle, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OverviewData {
  overview: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
  };
  scores: {
    avgScore: number;
    minScore: number;
    maxScore: number;
  };
  duration?: {
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
  };
  costs: {
    totalCost: number;
    avgCost: number;
  };
}

const cardConfig = [
  {
    title: 'Total Runs',
    valueKey: 'overview.totalRuns' as const,
    icon: Activity,
    color: 'text-blue-500',
  },
  {
    title: 'Success Rate',
    valueKey: 'overview.successRate' as const,
    icon: CheckCircle,
    color: 'text-green-500',
    format: 'percentage' as const,
  },
  {
    title: 'Average Score',
    valueKey: 'scores.avgScore' as const,
    icon: TrendingUp,
    color: 'text-purple-500',
    format: 'score' as const,
  },
  {
    title: 'Min Score',
    valueKey: 'scores.minScore' as const,
    icon: TrendingDown,
    color: 'text-orange-500',
    format: 'score' as const,
  },
  {
    title: 'Max Score',
    valueKey: 'scores.maxScore' as const,
    icon: TrendingUp,
    color: 'text-emerald-500',
    format: 'score' as const,
  },
  {
    title: 'Total Cost',
    valueKey: 'costs.totalCost' as const,
    icon: DollarSign,
    color: 'text-yellow-500',
    format: 'currency' as const,
  },
  {
    title: 'Avg Cost/Run',
    valueKey: 'costs.avgCost' as const,
    icon: DollarSign,
    color: 'text-orange-500',
    format: 'currency' as const,
  },
];

function formatValue(value: number, format?: string): string {
  if (format === 'percentage') {
    return `${value.toFixed(1)}%`;
  }
  if (format === 'score') {
    return value.toFixed(1);
  }
  if (format === 'currency') {
    return `$${value.toFixed(2)}`;
  }
  if (format === 'duration') {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}m ${seconds}s`;
  }
  return value.toString();
}

export function DashboardOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
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
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <XCircle className="h-8 w-8" />
        <p className="ml-2">Failed to load analytics</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary border-t-transparent" />
        <p className="ml-2">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cardConfig.map((config) => {
        const value = getNestedValue(data, config.valueKey);
        const Icon = config.icon;

        return (
          <Card key={config.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {config.title}
              </CardTitle>
              <Icon className={cn('h-4 w-4', config.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatValue(value, config.format)}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getNestedValue(obj: any, key: string): any {
  const keys = key.split('.');
  let value: any = obj;
  for (const k of keys) {
    if (value && value[k] !== undefined) {
      value = value[k];
    }
  }
  return value;
}
