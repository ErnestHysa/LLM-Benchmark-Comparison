/**
 * Analytics Queries
 *
 * Database query functions for analytics data
 */

import { PrismaClient } from "@prisma/client";
import { ModelRun, BenchmarkStats } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Get benchmark with its runs
 */
export async function getBenchmarkWithRuns(benchmarkRunId: string) {
  return prisma.benchmarkRun.findUnique({
    where: { id: benchmarkRunId },
    include: {
      modelRuns: {
        orderBy: { startedAt: "desc" },
        take: 100,
      },
    },
  });
}

/**
 * Get recent benchmark runs across all benchmarks
 */
export async function getRecentRuns(limit: number = 50) {
  return prisma.modelRun.findMany({
    where: {
      status: { in: ["COMPLETED", "FAILED", "PARTIAL"] },
    },
    include: {
      benchmarkRun: {
        include: {
          benchmark: {
            select: {
              id: true,
              name: true,
              primaryCategory: true,
            },
          },
        },
      },
    },
    orderBy: { completedAt: "desc" },
    take: limit,
  });
}

/**
 * Get runs grouped by time period for stats
 */
export async function getRunsByPeriod(periodStart: Date, periodEnd: Date): Promise<ModelRun[]> {
  return prisma.modelRun.findMany({
    where: {
      completedAt: {
        gte: periodStart,
        lte: periodEnd,
      },
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
    orderBy: { completedAt: "desc" },
  });
}

/**
 * Create or update benchmark stats entry
 */
export async function upsertBenchmarkStats(
  benchmarkId: string,
  modelId: string,
  period: string,
  stats: {
    avgScore: number;
    minScore: number;
    maxScore: number;
    runCount: number;
    successRate: number;
  }
): Promise<void> {
  await prisma.benchmarkStats.upsert({
    where: {
      benchmarkId_modelId_period_periodStart: {
        benchmarkId,
        modelId,
        period,
        periodStart: new Date(),
      },
    },
    create: {
      benchmarkId,
      modelId,
      period,
      periodStart: new Date(),
      periodEnd: new Date(),
      ...stats,
    },
    update: {
      ...stats,
      periodStart: new Date(),
      periodEnd: new Date(),
    },
  });
}

/**
 * Get benchmark stats for a specific period
 */
export async function getBenchmarkStats(
  benchmarkId: string,
  modelId: string,
  period: string,
  periodStart?: Date
): Promise<BenchmarkStats | null> {
  return prisma.benchmarkStats.findUnique({
    where: {
      benchmarkId_modelId_period_periodStart: {
        benchmarkId,
        modelId,
        period,
        periodStart: periodStart || new Date(),
      },
    },
  });
}

/**
 * Get all benchmark stats (for overview)
 */
export async function getAllBenchmarkStats(
  periodStart?: Date,
  periodEnd?: Date
): Promise<BenchmarkStats[]> {
  const where: Record<string, unknown> = {};

  if (periodStart && periodEnd) {
    // For a specific period, get all stats for that period
    const periodKey = periodStart.toISOString().split("T")[0];
    (where as any).period = periodKey;
  }

  return prisma.benchmarkStats.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get model run counts by status
 */
export async function getRunCountsByStatus(
  benchmarkRunId?: string
): Promise<{ successful: number; failed: number; total: number }> {
  const where: Record<string, unknown> = {
    status: { in: ["COMPLETED", "FAILED"] },
  };

  if (benchmarkRunId) {
    (where as any).benchmarkRunId = benchmarkRunId;
  }

  const successful = await prisma.modelRun.count({
    where: { ...where, status: "COMPLETED" },
  });

  const failed = await prisma.modelRun.count({
    where: { ...where, status: "FAILED" },
  });

  const total = successful + failed;

  return { successful, failed, total };
}

/**
 * Get cost statistics for a specific period or benchmark
 */
export async function getCostStats(
  periodStart?: Date,
  periodEnd?: Date,
  benchmarkRunId?: string
): Promise<{
  totalCost: number;
  totalRuns: number;
  avgCost: number;
  byProvider: Record<string, number>;
}> {
  const where: Record<string, unknown> = {
    status: "COMPLETED",
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

  // Aggregate cost data from ModelRun
  const modelRuns = await prisma.modelRun.findMany({
    where,
    include: {
      benchmarkRun: {
        select: {
          evaluator: true, // Contains provider info like "OPENAI:gpt-4o"
        },
      },
    },
  });

  let totalCost = 0;
  const byProvider: Record<string, number> = {};

  for (const run of modelRuns) {
    // Use stored cost if available, otherwise estimate from tokens
    const cost = run.cost ?? 0;
    totalCost += cost;

    // Extract provider from evaluator field (format: "PROVIDER:model")
    const evaluator = run.benchmarkRun?.evaluator || "UNKNOWN";
    const provider = evaluator.split(":")[0] || "UNKNOWN";

    byProvider[provider] = (byProvider[provider] || 0) + cost;
  }

  const totalRuns = modelRuns.length;
  const avgCost = totalRuns > 0 ? totalCost / totalRuns : 0;

  return {
    totalCost,
    totalRuns,
    avgCost,
    byProvider,
  };
}
