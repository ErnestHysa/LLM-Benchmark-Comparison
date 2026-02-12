/**
 * Analytics Aggregators
 *
 * Functions to aggregate benchmark run data into statistics
 */

import { PrismaClient } from '@prisma/client';
import { ModelRun } from '@prisma/client';
import { calculateStats } from './calculators';
import { getProviderFromModelId } from './calculators';

const prisma = new PrismaClient();

/**
 * Aggregated benchmark statistics
 */
export interface BenchmarkStatistics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  avgDuration?: number;
  minDuration?: number;
  maxDuration?: number;
  totalCost?: number;
  avgCost?: number;
}

/**
 * Model performance ranking
 */
export interface ModelRanking {
  modelId: string;
  modelName: string;
  avgScore: number;
  minScore: number;
  maxScore: number;
  runCount: number;
  successRate: number;
}

/**
 * Cost breakdown by provider
 */
export interface ProviderCosts {
  provider: string;
  totalCost: number;
  runCount: number;
  avgCost: number;
  percentage: number;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  date: string;
  value: number;
}

/**
 * Calculate success rate
 */
function calculateSuccessRate(successful: number, total: number): number {
  return total > 0 ? (successful / total) * 100 : 0;
}

/**
 * Get overall benchmark statistics
 */
export async function getBenchmarkStatistics(
  benchmarkRunId?: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<BenchmarkStatistics> {
  const where: Record<string, unknown> = {
    status: 'COMPLETED',
  };

  if (benchmarkRunId) {
    (where as any).benchmarkRunId = benchmarkRunId;
  }

  if (periodStart && periodEnd) {
    (where as any).completedAt = {
      gte: periodStart,
      lte: periodEnd,
    };
  }

  const runs = await prisma.modelRun.findMany({
    where,
    include: {
      benchmarkRun: {
        include: {
          benchmark: {
            select: {
              primaryCategory: true,
            },
          },
        },
      },
    },
  });

  const successfulRuns = runs.filter((r: any) => r.status === 'COMPLETED').length;
  const failedRuns = runs.filter((r: any) => r.status === 'FAILED').length;
  const successRate = calculateSuccessRate(successfulRuns, runs.length);

  // Get scores from successful runs
  const scores = await Promise.all(
    runs.map(async (run: any) => {
      const categoryScores = await prisma.categoryScore.findMany({
        where: { modelRunId: run.id },
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      const totalScore = categoryScores.reduce((sum: number, cs: any) => sum + (cs.value || 0), 0);
      return totalScore;
    })
  );

  const stats = calculateStats(scores);

  // Calculate durations
  const durations = runs
    .map((r: any) => r.completedAt && r.startedAt
      ? new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
      : undefined)
    .filter((d): d is number => d !== undefined);

  const durationStats = durations.length > 0 ? calculateStats(durations.map((d) => d / 1000)) : undefined;

  // Calculate costs (sum from ModelRun.cost field)
  const costRuns = runs.filter((r: any) => r.cost !== null && r.cost !== undefined);
  const costValues = costRuns.map((r: any) => r.cost || 0);
  const totalCost = costValues.reduce((sum: number, cost: number) => sum + cost, 0);
  const avgCost = costValues.length > 0 ? totalCost / costValues.length : undefined;

  return {
    totalRuns: runs.length,
    successfulRuns,
    failedRuns,
    successRate,
    avgScore: stats.avg,
    minScore: stats.min,
    maxScore: stats.max,
    avgDuration: durationStats?.avg,
    minDuration: durationStats?.min,
    maxDuration: durationStats?.max,
    totalCost,
    avgCost,
  };
}

/**
 * Get model rankings for a benchmark
 */
export async function getModelRankings(
  benchmarkRunId: string,
  limit: number = 10
): Promise<ModelRanking[]> {
  // Get all model runs for this benchmark
  const modelRuns = await prisma.modelRun.findMany({
    where: {
      benchmarkRunId,
      status: 'COMPLETED',
    },
    include: {
      benchmarkRun: {
        include: {
          benchmark: {
            select: { primaryCategory: true },
          },
        },
      },
    },
  });

  // Group by model ID
  const modelGroups = new Map<string, ModelRun[]>();

  for (const run of modelRuns) {
    const runs = modelGroups.get(run.modelId) || [];
    runs.push(run);
    modelGroups.set(run.modelId, runs);
  }

  // Calculate stats for each model
  const rankings: ModelRanking[] = [];

  for (const [modelId, runs] of modelGroups.entries()) {
    const scores = await Promise.all(
      runs.map(async (run: any) => {
        const categoryScores = await prisma.categoryScore.findMany({
          where: { modelRunId: run.id },
        });

        const totalScore = categoryScores.reduce((sum: number, cs: any) => sum + (cs.value || 0), 0);
        return totalScore;
      })
    );

    const runStats = calculateStats(scores);
    const successfulRuns = runs.filter((r: any) => r.status === 'COMPLETED').length;

    rankings.push({
      modelId,
      modelName: modelId, // Will be resolved to display name later
      avgScore: runStats.avg,
      minScore: runStats.min,
      maxScore: runStats.max,
      runCount: runs.length,
      successRate: calculateSuccessRate(successfulRuns, runs.length),
    });
  }

  // Sort by average score descending
  rankings.sort((a, b) => b.avgScore - a.avgScore);

  return rankings.slice(0, limit);
}

/**
 * Get cost breakdown by provider
 */
export async function getCostBreakdown(
  periodStart?: Date,
  periodEnd?: Date
): Promise<ProviderCosts[]> {
  const where: Record<string, unknown> = {
    cost: { not: null },
    status: 'COMPLETED',
  };

  if (periodStart && periodEnd) {
    const run = await prisma.modelRun.findFirst({
      where: { completedAt: { gte: periodStart, lte: periodEnd } },
    });
    if (run) {
      (where as any).completedAt = { gte: periodStart, lte: periodEnd };
    }
  }

  const runs = await prisma.modelRun.findMany({
    where,
    include: {
      benchmarkRun: {
        include: {
          benchmark: {
            select: { primaryCategory: true },
          },
        },
      },
    },
  });

  // Group by provider (extract from model ID)
  const providerGroups = new Map<string, { runs: ModelRun[]; totalCost: number }>();

  for (const run of runs) {
    const cost = (run as any).cost || 0;
    const provider = getProviderFromModelId(run.modelId);

    const group = providerGroups.get(provider) || { runs: [], totalCost: 0 };
    group.runs.push(run);
    group.totalCost += cost;
    providerGroups.set(provider, group);
  }

  // Convert to array
  const breakdown = Array.from(providerGroups.entries()).map(([provider, data]) => {
    const avgCost = data.runs.length > 0 ? data.totalCost / data.runs.length : 0;

    return {
      provider,
      totalCost: data.totalCost,
      runCount: data.runs.length,
      avgCost,
      percentage: 0, // Will be calculated when we have total
    };
  });

  return breakdown;
}

/**
 * Get trend data over time
 */
export async function getTrendData(
  benchmarkRunId?: string,
  _modelIds?: string[],
  period: '7d' | '30d' | '90d' | 'all' = '30d',
  periodStart?: Date,
  periodEnd?: Date
): Promise<{
  scores: { dates: string[]; models: Array<{ modelId: string; modelName: string; data: number[] }> };
  costs: { dates: string[]; cumulative: number[]; daily: number[] };
}> {
  const now = new Date();
  let startDate: Date;

  if (period === 'all') {
    startDate = new Date(0);
  } else if (period === '7d') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === '90d') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 90);
  } else {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
  }

  if (periodEnd) {
    startDate = periodStart || startDate;
  }

  const where: Record<string, unknown> = {
    status: 'COMPLETED',
    completedAt: { gte: startDate, lte: periodEnd || now },
  };

  if (benchmarkRunId) {
    (where as any).benchmarkRunId = benchmarkRunId;
  }

  // Get completed runs
  const runs = await prisma.modelRun.findMany({
    where,
    include: {
      benchmarkRun: {
        include: {
          benchmark: {
            select: { primaryCategory: true },
          },
        },
      },
    },
  });

  // Group by date for scores
  const dailyScores = new Map<string, number[]>();

  for (const run of runs) {
    if (!run.completedAt) continue;
    const dateKey = run.completedAt.toISOString().split('T')[0];
    const scores = dailyScores.get(dateKey) || [];

    const categoryScores = await prisma.categoryScore.findMany({
      where: { modelRunId: run.id },
    });

    const totalScore = categoryScores.reduce((sum: number, cs: any) => sum + (cs.value || 0), 0);
    scores.push(totalScore);

    dailyScores.set(dateKey, scores);
  }

  // Sort dates
  const sortedDates = Array.from(dailyScores.keys()).sort();

  // Group by model for scores
  const modelScoreData = new Map<string, number[]>();

  for (const run of runs) {
    const scores = modelScoreData.get(run.modelId) || [];
    const categoryScores = await prisma.categoryScore.findMany({
      where: { modelRunId: run.id },
    });

    const totalScore = categoryScores.reduce((sum: number, cs: any) => sum + (cs.value || 0), 0);
    modelScoreData.set(run.modelId, [...scores, totalScore]);
  }

  const modelsData = Array.from(modelScoreData.entries()).map(([modelId, scores]) => ({
    modelId,
    modelName: modelId, // Will resolve later
    data: scores,
  }));

  // Calculate costs by date
  const costByDate = new Map<string, number>();

  for (const run of runs) {
    if (!run.completedAt) continue;
    const dateKey = run.completedAt.toISOString().split('T')[0];
    const currentCost = costByDate.get(dateKey) || 0;
    costByDate.set(dateKey, currentCost + ((run as any).cost || 0));
  }

  const costDates = Array.from(costByDate.keys()).sort();
  const costCumulative: number[] = [];
  let cumulative = 0;

  for (const date of costDates) {
    const cost = costByDate.get(date) || 0;
    cumulative += cost;
    costCumulative.push(cumulative);
  }

  // Daily costs for bar chart
  const dailyCosts: number[] = Array.from(costByDate.values());

  return {
    scores: {
      dates: sortedDates,
      models: modelsData,
    },
    costs: {
      dates: costDates,
      cumulative: costCumulative,
      daily: dailyCosts,
    },
  };
}
