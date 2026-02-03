/**
 * GET /api/results/[id]
 *
 * Get benchmark result details with comparison
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ResultParamsSchema } from "@/lib/validators";
import { errorResponse, getStatusCode, NotFoundError } from "@/lib/errors";
import { logError } from "@/lib/errors";
import { calculateRankings } from "@/lib/scoring";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Validate ID
    const validationResult = ResultParamsSchema.safeParse({ id });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid result ID" } },
        { status: 400 }
      );
    }

    // Get benchmark run
    const benchmarkRun = await prisma.benchmarkRun.findUnique({
      where: { id: validationResult.data.id },
      include: {
        benchmark: {
          select: {
            id: true,
            name: true,
            description: true,
            prompt: true,
            primaryCategory: true,
          },
        },
        modelRuns: {
          include: {
            scores: {
              include: {
                category: {
                  select: {
                    name: true,
                    color: true,
                  },
                },
                metric: true,
              },
            },
            categoryScores: {
              include: {
                category: {
                  select: {
                    name: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!benchmarkRun) {
      throw new NotFoundError("Benchmark run", id);
    }

    // Calculate duration
    const duration = benchmarkRun.completedAt
      ? benchmarkRun.completedAt.getTime() - benchmarkRun.startedAt.getTime()
      : null;

    // Format model results
    const modelResults = benchmarkRun.modelRuns.map((modelRun) => {
      // Calculate category scores
      const categoryScores = modelRun.categoryScores.map((cs) => ({
        category: cs.category.name,
        score: cs.totalScore,
        color: cs.category.color,
      }));

      // Calculate total score
      const totalScore = categoryScores.length > 0
        ? categoryScores.reduce((sum, cs) => sum + cs.score, 0) / categoryScores.length
        : 0;

      // Get metrics breakdown
      const metrics = modelRun.scores.map((score) => ({
        category: score.category.name,
        metricName: score.metric?.name || "Overall",
        score: score.value,
        weight: score.metric?.weight || 1,
        confidence: score.aiConfidence,
      }));

      return {
        modelId: modelRun.modelId,
        modelName: modelRun.modelId, // In production, would look up model name
        status: modelRun.status,
        totalScore,
        output: modelRun.output,
        tokensUsed: modelRun.tokensUsed,
        cost: modelRun.cost,
        categoryScores,
        metrics,
      };
    });

    // Calculate rankings
    const scores = modelResults
      .filter((m) => m.status === "COMPLETED")
      .map((m) => ({ modelId: m.modelId, score: m.totalScore }));

    const rankings = calculateRankings(scores);

    // Add rankings to model results
    const modelResultsWithRank = modelResults.map((mr) => {
      const ranking = rankings.find((r) => r.modelId === mr.modelId);
      return {
        ...mr,
        rank: ranking?.rank ?? null,
        percentile: ranking?.percentile ?? null,
      };
    });

    // Sort by rank
    modelResultsWithRank.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

    return NextResponse.json({
      result: {
        id: benchmarkRun.id,
        benchmarkId: benchmarkRun.benchmarkId,
        benchmarkName: benchmarkRun.benchmark.name,
        benchmarkPrompt: benchmarkRun.benchmark.prompt,
        completedAt: benchmarkRun.completedAt?.toISOString(),
        duration,
        durationFormatted: duration
          ? `${Math.floor(duration / 1000)}s`
          : null,
        evaluator: benchmarkRun.evaluator,
        concurrency: benchmarkRun.concurrency,
        modelResults: modelResultsWithRank,
      },
    });
  } catch (error) {
    logError(error, { context: "GET /api/results/[id]" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}
