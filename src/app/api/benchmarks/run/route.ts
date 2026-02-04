/**
 * POST /api/benchmarks/run
 *
 * Execute a benchmark against selected models
 * This is a complex route that:
 * 1. Creates benchmark run record
 * 2. Executes parallel LLM calls (with configurable concurrency)
 * 3. Evaluates outputs using evaluator service
 * 4. Saves results to database
 * 5. Returns benchmark run ID for polling
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RunBenchmarkSchema } from "@/lib/validators";
import { errorResponse, getStatusCode, ValidationError, NotFoundError } from "@/lib/errors";
import { logError } from "@/lib/errors";
import { chat } from "@/lib/llm";
import { evaluateOutput, getCategoryMetrics } from "@/lib/llm/evaluator";
import { retryWithBackoff } from "@/lib/utils/retry";
import { classifyBenchmarkError, getBenchmarkErrorMessage } from "@/lib/utils/errors";

/**
 * Simple in-memory rate limiter per IP
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Execute model run with timeout
 */
async function executeModelRun(
  benchmark: { id: string; name: string; prompt: string },
  modelId: string,
  categories: string[],
  evaluator: string,
  evaluatorProvider: string,
  apiKeys?: Record<string, string>,
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<{
  modelId: string;
  output: string;
  tokensUsed?: number;
  evaluation: any;
  error?: string;
}> {
  console.info("[Run API] Executing model run:", {
    modelId,
    evaluator: `${evaluatorProvider}:${evaluator}`,
    hasApiKeys: !!apiKeys,
    timeoutMs,
  });

  try {
    // Check for abort signal
    if (signal?.aborted) {
      throw new Error("Run cancelled");
    }

    // Step 1: Get LLM output
    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful AI assistant. Provide a complete, accurate response.",
      },
      { role: "user" as const, content: benchmark.prompt },
    ];

    console.info("[Run API] Calling LLM chat for model:", modelId);

    const llmResponse = await retryWithBackoff(
      () => chat(
        modelId,
        messages,
        {
          temperature: 0.7,
          maxTokens: 4096,
          timeoutMs,
        },
        apiKeys
      ),
      {
        maxRetries: 3,
        baseDelay: 2000,
        onRetry: (attempt, error, delay) => {
          console.warn(`[Run API] Retry ${attempt}/3 for model ${modelId}: ${error.message}. Next retry in ${delay}ms`);
        },
      }
    );

    console.info("[Run API] LLM response received for model:", {
      modelId,
      contentLength: llmResponse.content?.length || 0,
      tokensUsed: llmResponse.tokensUsed,
    });

    // Check for abort again
    if (signal?.aborted) {
      throw new Error("Run cancelled");
    }

    // Step 2: Evaluate output
    console.info("[Run API] Evaluating output with evaluator:", {
      evaluator: `${evaluatorProvider}:${evaluator}`,
      outputLength: llmResponse.content?.length || 0,
    });

    const evaluation = await evaluateOutput({
      modelId,
      output: llmResponse.content,
      prompt: benchmark.prompt,
      categories,
      evaluatorModelId: evaluator,
      evaluatorProvider: evaluatorProvider.toLowerCase() as any,
      evaluatorApiKey: apiKeys?.[evaluatorProvider.toLowerCase()],
      benchmarkId: benchmark.id,
    });

    console.info("[Run API] Evaluation completed for model:", {
      modelId,
      totalScore: evaluation?.totalScore,
    });

    return {
      modelId,
      output: llmResponse.content,
      tokensUsed: llmResponse.tokensUsed,
      evaluation,
    };
  } catch (error) {
    const errorType = classifyBenchmarkError(error);
    const userMessage = getBenchmarkErrorMessage(errorType, modelId);

    console.error("[Run API] Model run failed for:", modelId, {
      errorType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      modelId,
      output: "",
      evaluation: null,
      error: userMessage,
    };
  }
}

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip, 10, 60000)) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many benchmark requests. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    console.info("[Run API] Received request:", {
      benchmarkId: body.benchmarkId,
      modelIds: body.modelIds,
      evaluator: body.evaluator,
      evaluatorProvider: body.evaluatorProvider,
      concurrency: body.concurrency,
      hasApiKeys: !!body.apiKeys,
      apiKeyProviders: body.apiKeys ? Object.keys(body.apiKeys) : [],
    });

    const validationResult = RunBenchmarkSchema.safeParse(body);

    if (!validationResult.success) {
      throw new ValidationError("Invalid request body", validationResult.error.flatten());
    }

    const {
      benchmarkId,
      modelIds,
      categories,
      evaluator,
      evaluatorProvider,
      concurrency,
      timeoutSec,
      apiKeys,
    } = validationResult.data;

    // Get benchmark
    const benchmark = await prisma.benchmark.findUnique({
      where: { id: benchmarkId },
      select: {
        id: true,
        name: true,
        description: true,
        prompt: true,
        primaryCategory: true,
      },
    });

    if (!benchmark) {
      throw new NotFoundError("Benchmark", benchmarkId);
    }

    // Use default categories if not specified
    const categoriesToEvaluate = categories?.length ? categories : [benchmark.primaryCategory];

    // Create benchmark run record
    const benchmarkRun = await prisma.benchmarkRun.create({
      data: {
        benchmarkId,
        evaluator: `${evaluatorProvider}:${evaluator}`,
        concurrency,
        timeoutSec,
        status: "RUNNING",
      },
    });

    // Create model run records
    const modelRuns = await Promise.all(
      modelIds.map((modelId) =>
        prisma.modelRun.create({
          data: {
            benchmarkRunId: benchmarkRun.id,
            modelId,
            status: "PENDING",
          },
        })
      )
    );

    // Execute runs in parallel with concurrency limit
    const timeoutMs = timeoutSec ? timeoutSec * 1000 : 600000; // 10 min default
    const results: Array<{
      modelId: string;
      output: string;
      tokensUsed?: number;
      evaluation: any;
      error?: string;
    }> = [];

    // Process with concurrency limit
    for (let i = 0; i < modelIds.length; i += concurrency) {
      const batch = modelIds.slice(i, i + concurrency);
      const batchPromises = batch.map((modelId) =>
        executeModelRun(
          benchmark,
          modelId,
          categoriesToEvaluate,
          evaluator,
          evaluatorProvider,
          apiKeys,
          timeoutMs
        )
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Save results to database
    for (const result of results) {
      const modelRun = modelRuns.find((mr) => mr.modelId === result.modelId);
      if (!modelRun) continue;

      if (result.error) {
        // Mark as failed
        await prisma.modelRun.update({
          where: { id: modelRun.id },
          data: {
            status: "FAILED",
            output: result.error,
            completedAt: new Date(),
          },
        });
        continue;
      }

      // Update model run with output
      await prisma.modelRun.update({
        where: { id: modelRun.id },
        data: {
          status: "COMPLETED",
          output: result.output,
          tokensUsed: result.tokensUsed,
          completedAt: new Date(),
        },
      });

      // Save category scores
      const { categoryEvaluations } = result.evaluation;

      for (const catEval of categoryEvaluations) {
        // Get or create category
        let category = await prisma.benchmarkCategory.findFirst({
          where: { name: catEval.category },
        });

        if (!category) {
          category = await prisma.benchmarkCategory.create({
            data: {
              name: catEval.category,
              description: `${catEval.category} evaluation category`,
            },
          });
        }

        // Save category score
        await prisma.categoryScore.create({
          data: {
            modelRunId: modelRun.id,
            categoryId: category.id,
            totalScore: catEval.totalScore,
          },
        });

        // Save metric scores
        for (const metric of catEval.metrics) {
          // Get or create metric definition
          let metricDef = await prisma.categoryMetric.findFirst({
            where: {
              categoryId: category.id,
              name: metric.name,
            },
          });

          if (!metricDef) {
            const metrics = getCategoryMetrics(catEval.category);
            const metricConfig = metrics.find((m) => m.name === metric.name);
            metricDef = await prisma.categoryMetric.create({
              data: {
                categoryId: category.id,
                name: metric.name,
                description: `${metric.name} evaluation metric`,
                weight: metricConfig?.weight ?? 1.0,
              },
            });
          }

          // Create score record
          const scoreRecord = await prisma.score.create({
            data: {
              modelRunId: modelRun.id,
              categoryId: category.id,
              metricId: metricDef.id,
              value: metric.score,
              aiConfidence: metric.confidence,
            },
          });

          // Create metric score (for detailed breakdown)
          await prisma.metricScore.create({
            data: {
              scoreId: scoreRecord.id,
              metricId: metricDef.id,
              value: metric.score,
              explanation: metric.reasoning,
            },
          });
        }
      }
    }

    // Update benchmark run status
    const hasFailures = results.some((r) => r.error);
    await prisma.benchmarkRun.update({
      where: { id: benchmarkRun.id },
      data: {
        status: hasFailures ? "COMPLETED" : "COMPLETED", // Still completed even with partial failures
        completedAt: new Date(),
      },
    });

    // Return response
    return NextResponse.json({
      runId: benchmarkRun.id,
      status: "COMPLETED",
      startedAt: benchmarkRun.startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      models: results.map((r) => ({
        modelId: r.modelId,
        status: r.error ? "FAILED" : "COMPLETED",
        totalScore: r.evaluation?.totalScore,
        error: r.error,
      })),
    });
  } catch (error) {
    logError(error, { context: "POST /api/benchmarks/run" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}
