/**
 * Analytics Dashboard Page
 *
 * Comprehensive analytics with trends, costs, and performance insights
 */

'use client';

import { useState } from 'react';
import { DashboardOverview } from '@/components/analytics/DashboardOverview';
import { TrendChart } from '@/components/analytics/TrendChart';
import { CostChart } from '@/components/analytics/CostChart';
import { ComparisonChart } from '@/components/analytics/ComparisonChart';
import { Heatmap } from '@/components/analytics/Heatmap';
import { TimeRangeSelector } from '@/components/analytics/TimeRangeSelector';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Period = '7d' | '30d' | '90d' | 'all';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [benchmarkId, setBenchmarkId] = useState<string>('');
  const [modelIds, setModelIds] = useState<string>('');

  const handleBenchmarkChange = (value: string) => {
    setBenchmarkId(value);
  };

  const handleModelChange = (value: string) => {
    setModelIds(value);
  };

  const modelIdsArray = modelIds ? modelIds.split(',').map((m) => m.trim()).filter(Boolean) : undefined;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mb-4">
          Comprehensive insights into benchmark performance, costs, and trends
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Benchmark</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              value={benchmarkId}
              onChange={(e) => handleBenchmarkChange(e.target.value)}
            >
              <option value="">All Benchmarks</option>
              {/* Benchmarks would be loaded here */}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Models (comma separated)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              placeholder="e.g. gpt-4o, claude-3-5-sonnet"
              value={modelIds}
              onChange={(e) => handleModelChange(e.target.value)}
            />
          </div>

          <TimeRangeSelector value={period} onChange={setPeriod} />
        </div>
      </Card>

      {/* Dashboard Tabs */}
      <Tabs defaultValue="overview" className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <TrendChart
            benchmarkId={benchmarkId || undefined}
            modelIds={modelIdsArray}
            period={period}
          />
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <CostChart period={period} />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          {benchmarkId ? (
            <ComparisonChart benchmarkId={benchmarkId} />
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Please select a benchmark to view comparison
            </Card>
          )}
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-4">
          <Heatmap period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
