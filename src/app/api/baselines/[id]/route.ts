/**
 * GET /api/baselines/[id] - Get a single baseline
 * PUT /api/baselines/[id] - Update a baseline
 * DELETE /api/baselines/[id] - Delete a baseline
 * POST /api/baselines/[id]/run - Manually trigger a regression test run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/llm";
import { evaluateOutput } from "@/lib/llm/evaluator";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/baselines/[id] - Get a single baseline
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const baseline = await prisma.regressionBaseline.findUnique({
      where: { id },
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
        runs: {
          orderBy: { startedAt: "desc" },
          take: 10,
          include: {
            modelRuns: {
              select: {
                modelId: true,
                totalScore: true,
                previousScore: true,
                scoreDiff: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!baseline) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Baseline not found" } },
        { status: 404 }
      );
    }

    // Parse modelIds from JSON
    let parsedModelIds: string[];
    let parsedScheduleConfig: any = null;

    try {
      parsedModelIds = JSON.parse(baseline.modelIds);
    } catch (error) {
      console.error(`[GET /api/baselines/${id}] Failed to parse modelIds:`, error);
      parsedModelIds = [];
    }

    try {
      parsedScheduleConfig = baseline.scheduleConfig ? JSON.parse(baseline.scheduleConfig) : null;
    } catch (error) {
      console.error(`[GET /api/baselines/${id}] Failed to parse scheduleConfig:`, error);
    }

    const baselineWithParsedModels = {
      ...baseline,
      modelIds: parsedModelIds,
      scheduleConfig: parsedScheduleConfig,
    };

    return NextResponse.json({ baseline: baselineWithParsedModels });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[GET /api/baselines/${id}] Error:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch baseline" } },
      { status: 500 }
    );
  }
}

// PUT /api/baselines/[id] - Update a baseline
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.regressionBaseline.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Baseline not found" } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.modelIds !== undefined) updateData.modelIds = JSON.stringify(body.modelIds);
    if (body.evaluator !== undefined) updateData.evaluator = body.evaluator;
    if (body.evaluatorProvider !== undefined) updateData.evaluatorProvider = body.evaluatorProvider;
    if (body.thresholdMin !== undefined) updateData.thresholdMin = body.thresholdMin;
    if (body.thresholdMax !== undefined) updateData.thresholdMax = body.thresholdMax;
    if (body.regressionDelta !== undefined) updateData.regressionDelta = body.regressionDelta;
    if (body.scheduleType !== undefined) updateData.scheduleType = body.scheduleType;
    if (body.scheduleConfig !== undefined) updateData.scheduleConfig = body.scheduleConfig;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    updateData.currentVersion = { increment: 1 };

    const baseline = await prisma.regressionBaseline.update({
      where: { id },
      data: updateData,
      include: {
        benchmark: {
          select: {
            id: true,
            name: true,
            primaryCategory: true,
          },
        },
      },
    });

    return NextResponse.json({ baseline });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[PUT /api/baselines/${id}] Error:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update baseline" } },
      { status: 500 }
    );
  }
}

// DELETE /api/baselines/[id] - Delete a baseline
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existing = await prisma.regressionBaseline.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Baseline not found" } },
        { status: 404 }
      );
    }

    await prisma.regressionBaseline.delete({
      where: { id },
    });

    console.info(`[DELETE /api/baselines/${id}] Deleted baseline`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[DELETE /api/baselines/${id}] Error:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete baseline" } },
      { status: 500 }
    );
  }
}

// POST /api/baselines/[id]/run - Manually trigger a regression test run
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const apiKeys = body.apiKeys;

    const baseline = await prisma.regressionBaseline.findUnique({
      where: { id },
      include: {
        benchmark: true,
      },
    });

    if (!baseline) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Baseline not found" } },
        { status: 404 }
      );
    }

    const modelIds = JSON.parse(baseline.modelIds);
    const categories = [baseline.benchmark.primaryCategory];

    // Get previous run for comparison
    const previousRun = await prisma.regressionRun.findFirst({
      where: {
        baselineId: id,
        status: { in: ["COMPLETED", "REGRESSED"] },
      },
      orderBy: { startedAt: "desc" },
      include: {
        modelRuns: true,
      },
    });

    // Create regression run record
    const regressionRun = await prisma.regressionRun.create({
      data: {
        baselineId: id,
        status: "RUNNING",
        triggerType: "manual",
      },
    });

    console.info("[POST /api/baselines/run] Starting regression run:", {
      baselineId: id,
      regressionRunId: regressionRun.id,
      modelIds,
    });

    // Execute benchmark runs in background
    // In production, this should be a background job
    executeRegressionTests({
      regressionRunId: regressionRun.id,
      baseline,
      modelIds,
      categories,
      apiKeys,
      previousRun,
    }).catch((error) => {
      console.error("[Regression] Background execution failed:", error);
    });

    return NextResponse.json({
      regressionRunId: regressionRun.id,
      status: "RUNNING",
      message: "Regression test started",
    });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[POST /api/baselines/${id}/run] Error:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to start regression test" } },
      { status: 500 }
    );
  }
}

/**
 * Execute regression tests in background
 */
async function executeRegressionTests({
  regressionRunId,
  baseline,
  modelIds,
  categories,
  apiKeys,
  previousRun,
}: {
  regressionRunId: string;
  baseline: any;
  modelIds: string[];
  categories: string[];
  apiKeys?: Record<string, string>;
  previousRun: any;
}) {
  try {
    const modelRunResults: Array<{
      modelId: string;
      totalScore: number;
      categoryScores: Array<{ category: string; score: number }>;
      status: string;
      errorMessage?: string;
    }> = [];

    // Run each model
    for (const modelId of modelIds) {
      try {
        // Generate output
        const messages = [
          {
            role: "system" as const,
            content: "You are a helpful AI assistant. Provide a complete, accurate response.",
          },
          { role: "user" as const, content: baseline.benchmark.prompt },
        ];

        const llmResponse = await chat(
          modelId,
          messages,
          {
            temperature: 0.7,
            maxTokens: 65536,
          },
          apiKeys
        );

        // Evaluate output
        const evaluation = await evaluateOutput({
          modelId,
          output: llmResponse.content,
          prompt: baseline.benchmark.prompt,
          categories,
          evaluatorModelId: baseline.evaluator,
          evaluatorProvider: baseline.evaluatorProvider.toLowerCase() as any,
          evaluatorApiKey: apiKeys?.[baseline.evaluatorProvider.toLowerCase()],
          benchmarkId: baseline.benchmark.id,
        });

        modelRunResults.push({
          modelId,
          totalScore: evaluation.totalScore,
          categoryScores: evaluation.categoryEvaluations.map((cat) => ({
            category: cat.category,
            score: cat.totalScore,
          })),
          status: "COMPLETED",
        });
      } catch (error) {
        console.error(`[Regression] Model ${modelId} failed:`, error);
        modelRunResults.push({
          modelId,
          totalScore: 0,
          categoryScores: [],
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate overall score
    const successfulScores = modelRunResults
      .filter((r) => r.status === "COMPLETED")
      .map((r) => r.totalScore);
    const totalScore = successfulScores.length > 0
      ? successfulScores.reduce((sum, score) => sum + score, 0) / successfulScores.length
      : 0;

    // Get previous overall score
    const previousScore = previousRun?.totalScore;
    const scoreDiff = previousScore !== null ? totalScore - previousScore : 0;

    // Check for regression
    let isRegression = false;
    if (baseline.regressionDelta && scoreDiff < -baseline.regressionDelta) {
      isRegression = true;
    }
    if (baseline.thresholdMin && totalScore < baseline.thresholdMin) {
      isRegression = true;
    }

    // Update regression run
    await prisma.regressionRun.update({
      where: { id: regressionRunId },
      data: {
        status: isRegression ? "REGRESSED" : "COMPLETED",
        totalScore,
        previousScore,
        scoreDiff,
        isRegression,
        completedAt: new Date(),
      },
    });

    // Save model runs
    for (const result of modelRunResults) {
      await prisma.regressionModelRun.create({
        data: {
          regressionRunId,
          modelId: result.modelId,
          totalScore: result.totalScore,
          previousScore: previousRun?.modelRuns?.find((mr: any) => mr.modelId === result.modelId)?.totalScore,
          scoreDiff: result.totalScore - (previousRun?.modelRuns?.find((mr: any) => mr.modelId === result.modelId)?.totalScore ?? 0),
          categoryScores: JSON.stringify(result.categoryScores),
          status: result.status,
          errorMessage: result.errorMessage,
        },
      });
    }

    // Update baseline
    await prisma.regressionBaseline.update({
      where: { id: baseline.id },
      data: {
        lastRunAt: new Date(),
        lastStatus: isRegression ? "regressed" : "success",
      },
    });

    // Create alert if regression detected
    if (isRegression) {
      await prisma.regressionAlert.create({
        data: {
          regressionRunId,
          baselineId: baseline.id,
          alertType: "score_dropped",
          severity: baseline.regressionDelta && scoreDiff < -baseline.regressionDelta * 2 ? "critical" : "warning",
          message: `Regression detected! Score dropped from ${previousScore?.toFixed(1) || "N/A"} to ${totalScore.toFixed(1)}`,
        },
      });
    }

    console.info("[Regression] Run completed:", {
      regressionRunId,
      totalScore,
      isRegression,
    });
  } catch (error) {
    console.error("[Regression] Execution failed:", error);
    await prisma.regressionRun.update({
      where: { id: regressionRunId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });
  }
}
