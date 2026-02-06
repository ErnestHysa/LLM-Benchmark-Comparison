/**
 * GET /api/statistics - Comprehensive statistical analysis
 *
 * Provides:
 * - Confidence intervals
 * - Statistical significance tests
 * - Outlier detection
 * - Trend analysis
 * - Cost vs performance analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Statistical utility functions
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[], meanValue?: number): number {
  const mu = meanValue ?? mean(values);
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mu, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function confidenceInterval(values: number[]): { lower: number; upper: number } {
  const mu = mean(values);
  const sigma = stdDev(values, mu);
  const n = values.length;

  // t-distribution approximation for 95% confidence
  const t = n > 30 ? 1.96 : 2.0; // Simplified t-value
  const margin = t * sigma / Math.sqrt(n);

  return {
    lower: mu - margin,
    upper: mu + margin,
  };
}

// Z-test for comparing two means
function zTest(sample1: number[], sample2: number[]): {
  zScore: number;
  pValue: number;
  significant: boolean;
} {
  const mu1 = mean(sample1);
  const mu2 = mean(sample2);
  const sigma1 = stdDev(sample1, mu1);
  const sigma2 = stdDev(sample2, mu2);
  const n1 = sample1.length;
  const n2 = sample2.length;

  // Pooled standard error
  const se = Math.sqrt(sigma1 * sigma1 / n1 + sigma2 * sigma2 / n2);

  if (se === 0) {
    return { zScore: 0, pValue: 1, significant: false };
  }

  const zScore = (mu1 - mu2) / se;
  // Two-tailed p-value approximation
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  return {
    zScore,
    pValue,
    significant: pValue < 0.05, // 95% confidence
  };
}

// Standard normal CDF approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// Detect outliers using IQR method
function detectOutliers(values: number[]): { outliers: number[]; indices: number[] } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers: number[] = [];
  const indices: number[] = [];

  values.forEach((v, i) => {
    if (v < lowerBound || v > upperBound) {
      outliers.push(v);
      indices.push(i);
    }
  });

  return { outliers, indices };
}

// Calculate trend (slope of linear regression)
function calculateTrend(values: number[], timestamps: Date[]): {
  slope: number;
  direction: "improving" | "declining" | "stable";
  correlation: number;
} {
  const n = values.length;
  if (n < 2 || !timestamps[0]) return { slope: 0, direction: "stable", correlation: 0 };

  // Convert timestamps to numeric values (days from start)
  const startTime = timestamps[0].getTime();
  const x = timestamps.map((t) => (t.getTime() - startTime) / (1000 * 60 * 60 * 24));
  const y = values;

  const meanX = mean(x);
  const meanY = mean(y);

  // Calculate slope and correlation
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i] ?? 0;
    const yi = y[i] ?? 0;
    const dx = xi - meanX;
    const dy = yi - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const slope = denomX === 0 ? 0 : numerator / denomX;
  const correlation = denomX === 0 || denomY === 0 ? 0 : numerator / Math.sqrt(denomX * denomY);

  // Determine direction (slope of 0.1 points per day is threshold)
  let direction: "improving" | "declining" | "stable" = "stable";
  if (Math.abs(slope) > 0.1) {
    direction = slope > 0 ? "improving" : "declining";
  }

  return { slope, direction, correlation };
}

// GET /api/statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("modelId");
    const benchmarkId = searchParams.get("benchmarkId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {
      benchmarkRun: {
        status: "COMPLETED",
      },
    };

    if (modelId) where.modelId = modelId;
    if (benchmarkId) where.benchmarkRun = { ...where.benchmarkRun, benchmarkId };
    if (startDate || endDate) {
      where.benchmarkRun.startedAt = {};
      if (startDate) where.benchmarkRun.startedAt.gte = new Date(startDate);
      if (endDate) where.benchmarkRun.startedAt.lte = new Date(endDate);
    }

    // Fetch all relevant model runs
    const modelRuns = await prisma.modelRun.findMany({
      where,
      include: {
        categoryScores: {
          include: {
            category: true,
          },
        },
        benchmarkRun: {
          select: {
            startedAt: true,
            benchmark: {
              select: {
                primaryCategory: true,
              },
            },
          },
        },
      },
      orderBy: {
        benchmarkRun: {
          startedAt: "desc",
        },
      },
      take: 1000,
    });

    // Group scores by model
    const modelData = new Map<string, number[]>();
    const modelTimestamps = new Map<string, Date[]>();
    const modelCosts = new Map<string, number[]>();

    for (const run of modelRuns) {
      const avgScore = run.categoryScores.length > 0
        ? run.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) / run.categoryScores.length
        : 0;

      if (!modelData.has(run.modelId)) {
        modelData.set(run.modelId, []);
        modelTimestamps.set(run.modelId, []);
        modelCosts.set(run.modelId, []);
      }

      modelData.get(run.modelId)!.push(avgScore);
      modelTimestamps.get(run.modelId)!.push(run.benchmarkRun.startedAt);
      modelCosts.get(run.modelId)!.push(run.cost || 0);
    }

    // Calculate statistics for each model
    const modelStats = Array.from(modelData.entries()).map(([modelId, scores]) => {
      const timestamps = modelTimestamps.get(modelId)!;
      const costs = modelCosts.get(modelId)!;
      const avgCost = mean(costs);

      const ci = confidenceInterval(scores);
      const outliers = detectOutliers(scores);
      const trend = calculateTrend(scores.reverse(), timestamps.reverse());

      return {
        modelId,
        count: scores.length,
        mean: mean(scores),
        stdDev: stdDev(scores),
        min: Math.min(...scores),
        max: Math.max(...scores),
        confidenceInterval: ci,
        outliers: outliers.outliers,
        outlierCount: outliers.outliers.length,
        trend,
        avgCost,
        costPerPoint: avgCost > 0 ? avgCost / mean(scores) : 0,
      };
    });

    // Compare models pairwise
    const comparisons: Array<{
      modelA: string;
      modelB: string;
      meanA: number;
      meanB: number;
      zScore: number;
      pValue: number;
      significant: boolean;
      winner: string;
    }> = [];

    const modelIds = Array.from(modelData.keys());
    for (let i = 0; i < modelIds.length; i++) {
      const modelIdI = modelIds[i];
      if (!modelIdI) continue;
      for (let j = i + 1; j < modelIds.length; j++) {
        const modelIdJ = modelIds[j];
        if (!modelIdJ) continue;
        const scoresA = modelData.get(modelIdI)!;
        const scoresB = modelData.get(modelIdJ)!;
        const test = zTest(scoresA, scoresB);

        comparisons.push({
          modelA: modelIdI,
          modelB: modelIdJ,
          meanA: mean(scoresA),
          meanB: mean(scoresB),
          zScore: test.zScore,
          pValue: test.pValue,
          significant: test.significant,
          winner: test.zScore > 0 ? modelIdI : modelIdJ,
        });
      }
    }

    // Overall statistics
    const allScores = Array.from(modelData.values()).flat();
    const overallStats = {
      totalRuns: modelRuns.length,
      totalModels: modelIds.length,
      overallMean: mean(allScores),
      overallStdDev: stdDev(allScores),
      overallMin: Math.min(...allScores),
      overallMax: Math.max(...allScores),
      overallCI: confidenceInterval(allScores),
    };

    return NextResponse.json({
      overall: overallStats,
      models: modelStats,
      comparisons,
    });
  } catch (error) {
    console.error("[GET /api/statistics] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to calculate statistics" } },
      { status: 500 }
    );
  }
}
