/**
 * POST /api/regression/check
 *
 * CI/CD Integration endpoint
 * Runs regression tests and returns appropriate exit code
 * Use in GitHub Actions, GitLab CI, etc.
 *
 * Example usage:
 *   curl -X POST http://localhost:3000/api/regression/check \
 *     -H "Content-Type: application/json" \
 *     -d '{"baselineId": "xxx", "apiKeys": {...}}'
 *
 * Exit codes:
 *   0 - All tests passed (no regression)
 *   1 - Regression detected or tests failed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { chat } from "@/lib/llm";
import { evaluateOutput } from "@/lib/llm/evaluator";

interface CIRequest {
  baselineId: string;
  apiKeys?: Record<string, string>;
  strictMode?: boolean; // Fail on any error, not just regression
}

interface CIResponse {
  success: boolean;
  shouldFail: boolean;
  baselineId: string;
  results: {
    totalScore: number;
    previousScore: number | null;
    scoreDiff: number | null;
    isRegression: boolean;
    modelResults: Array<{
      modelId: string;
      score: number;
      previousScore: number | null;
      passed: boolean;
    }>;
  };
  alerts: string[];
  summary: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: CIRequest = await request.json();

    if (!body.baselineId) {
      throw new ValidationError("Missing baselineId", {
        baselineId: ["baselineId is required"],
      });
    }

    const baseline = await prisma.regressionBaseline.findUnique({
      where: { id: body.baselineId },
      include: {
        benchmark: true,
      },
    });

    if (!baseline) {
      throw new NotFoundError("Baseline", body.baselineId);
    }

    const modelIds = JSON.parse(baseline.modelIds);
    const categories = [baseline.benchmark.primaryCategory];

    console.info("[CI] Starting regression check:", {
      baselineId: body.baselineId,
      modelIds,
      strictMode: body.strictMode ?? false,
    });

    // Get previous run for comparison
    const previousRun = await prisma.regressionRun.findFirst({
      where: {
        baselineId: body.baselineId,
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
        baselineId: body.baselineId,
        status: "RUNNING",
        triggerType: "ci",
        triggerMetadata: JSON.stringify({
          strictMode: body.strictMode ?? false,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // Execute tests
    const modelResults: Array<{
      modelId: string;
      score: number;
      previousScore: number | null;
      passed: boolean;
      errorMessage?: string;
    }> = [];

    const alerts: string[] = [];

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
          body.apiKeys
        );

        // Evaluate output
        const evaluation = await evaluateOutput({
          modelId,
          output: llmResponse.content,
          prompt: baseline.benchmark.prompt,
          categories,
          evaluatorModelId: baseline.evaluator,
          evaluatorProvider: baseline.evaluatorProvider.toLowerCase() as any,
          evaluatorApiKey: body.apiKeys?.[baseline.evaluatorProvider.toLowerCase()],
          benchmarkId: baseline.benchmark.id,
        });

        // Get previous score
        const previousModelRun = previousRun?.modelRuns?.find(
          (mr: any) => mr.modelId === modelId
        );
        const previousScore = previousModelRun?.totalScore ?? null;
        const scoreDiff = previousScore !== null ? evaluation.totalScore - previousScore : null;

        // Check thresholds
        let passed = true;
        if (baseline.regressionDelta && scoreDiff !== null && scoreDiff < -baseline.regressionDelta) {
          passed = false;
          alerts.push(
            `Model ${modelId}: Regression detected! Score dropped by ${Math.abs(scoreDiff).toFixed(1)} points`
          );
        }
        if (baseline.thresholdMin && evaluation.totalScore < baseline.thresholdMin) {
          passed = false;
          alerts.push(
            `Model ${modelId}: Score ${evaluation.totalScore.toFixed(1)} below minimum threshold ${baseline.thresholdMin}`
          );
        }

        modelResults.push({
          modelId,
          score: evaluation.totalScore,
          previousScore,
          passed,
        });
      } catch (error) {
        console.error(`[CI] Model ${modelId} failed:`, error);
        modelResults.push({
          modelId,
          score: 0,
          previousScore: null,
          passed: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        alerts.push(`Model ${modelId}: Failed - ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Calculate overall results
    const successfulScores = modelResults.filter((r) => r.score > 0).map((r) => r.score);
    const totalScore = successfulScores.length > 0
      ? successfulScores.reduce((sum, score) => sum + score, 0) / successfulScores.length
      : 0;
    const previousScore = previousRun?.totalScore ?? null;
    const scoreDiff = previousScore !== null ? totalScore - previousScore : null;

    // Determine if tests should fail CI
    const hasRegression = modelResults.some((r) => !r.passed);
    const hasErrors = modelResults.some((r) => r.errorMessage !== undefined);
    const shouldFail = body.strictMode
      ? hasRegression || hasErrors
      : hasRegression;

    const isRegression = hasRegression;

    // Update regression run
    await prisma.regressionRun.update({
      where: { id: regressionRun.id },
      data: {
        status: shouldFail ? "REGRESSED" : "COMPLETED",
        totalScore,
        previousScore,
        scoreDiff,
        isRegression,
        completedAt: new Date(),
      },
    });

    // Save model runs
    for (const result of modelResults) {
      await prisma.regressionModelRun.create({
        data: {
          regressionRunId: regressionRun.id,
          modelId: result.modelId,
          totalScore: result.score,
          previousScore: result.previousScore,
          scoreDiff: result.previousScore !== null ? result.score - result.previousScore : 0,
          categoryScores: "[]",
          status: result.errorMessage ? "FAILED" : "COMPLETED",
          errorMessage: result.errorMessage,
        },
      });
    }

    // Update baseline
    await prisma.regressionBaseline.update({
      where: { id: body.baselineId },
      data: {
        lastRunAt: new Date(),
        lastStatus: shouldFail ? "regressed" : "success",
      },
    });

    // Create alerts if needed
    if (alerts.length > 0) {
      for (const alertMsg of alerts) {
        await prisma.regressionAlert.create({
          data: {
            regressionRunId: regressionRun.id,
            baselineId: body.baselineId,
            alertType: shouldFail ? "regression" : "info",
            severity: shouldFail ? "critical" : "info",
            message: alertMsg,
          },
        });
      }
    }

    const duration = Date.now() - startTime;

    const response: CIResponse = {
      success: !shouldFail,
      shouldFail,
      baselineId: body.baselineId,
      results: {
        totalScore,
        previousScore,
        scoreDiff,
        isRegression,
        modelResults,
      },
      alerts,
      summary: shouldFail
        ? `CI FAILED: Regression detected or errors occurred`
        : `CI PASSED: All models scored within acceptable thresholds`,
    };

    console.info("[CI] Regression check completed:", {
      duration,
      shouldFail,
      totalScore,
      alerts: alerts.length,
    });

    return NextResponse.json(response, {
      status: shouldFail ? 400 : 200,
      headers: {
        "X-CI-Status": shouldFail ? "failure" : "success",
        "X-CI-Duration": duration.toString(),
      },
    });
  } catch (error) {
    console.error("[POST /api/regression/check] Error:", error);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(
        {
          success: false,
          shouldFail: true,
          error: error instanceof Error ? error.message : "Unknown error",
          alerts: [error instanceof Error ? error.message : "Unknown error"],
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        shouldFail: true,
        error: "Internal server error",
        alerts: ["Internal server error during regression check"],
      },
      { status: 500 }
    );
  }
}
