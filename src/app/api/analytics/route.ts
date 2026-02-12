/**
 * GET /api/analytics
 *
 * General analytics endpoint for overview statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { getRunCountsByStatus, getAllBenchmarkStats, getCostStats } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkRunId = searchParams.get("benchmarkRunId");
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    // Parse date range if provided
    const startDate = periodStart ? new Date(periodStart) : undefined;
    const endDate = periodEnd ? new Date(periodEnd) : undefined;

    // If specific benchmark, get its run counts and costs
    if (benchmarkRunId) {
      const counts = await getRunCountsByStatus(benchmarkRunId);
      const costStats = await getCostStats(startDate, endDate, benchmarkRunId);

      return NextResponse.json({
        overview: {
          totalRuns: counts.total,
          successfulRuns: counts.successful,
          failedRuns: counts.failed,
          successRate: counts.total > 0 ? (counts.successful / counts.total) * 100 : 0,
        },
        scores: {
          avgScore: 0,
          minScore: 0,
          maxScore: 0,
        },
        costs: {
          totalCost: costStats.totalCost,
          avgCost: costStats.avgCost,
          byProvider: costStats.byProvider,
        },
      });
    }

    // Otherwise, get all-time stats
    const allStats = await getAllBenchmarkStats(startDate, endDate);
    const costStats = await getCostStats(startDate, endDate);

    // Aggregate across all benchmarks
    const totalRuns = allStats.reduce((sum, s) => sum + s.runCount, 0);
    const totalSuccessful = allStats.reduce(
      (sum, s) => sum + (s.successRate > 0 ? Math.round((s.runCount * s.successRate) / 100) : 0),
      0
    );
    const totalFailed = totalRuns - totalSuccessful;

    // Calculate average scores
    const avgScore =
      totalRuns > 0 ? allStats.reduce((sum, s) => sum + s.avgScore * s.runCount, 0) / totalRuns : 0;
    const minScore = allStats.length > 0 ? Math.min(...allStats.map((s) => s.minScore)) : 0;
    const maxScore = allStats.length > 0 ? Math.max(...allStats.map((s) => s.maxScore)) : 0;

    return NextResponse.json({
      overview: {
        totalRuns,
        successfulRuns: totalSuccessful,
        failedRuns: totalFailed,
        successRate: totalRuns > 0 ? (totalSuccessful / totalRuns) * 100 : 0,
      },
      scores: {
        avgScore,
        minScore,
        maxScore,
      },
      costs: {
        totalCost: costStats.totalCost,
        avgCost: costStats.avgCost,
        byProvider: costStats.byProvider,
      },
    });
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
  }
}
