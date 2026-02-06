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
 * Includes automatic cleanup of expired entries to prevent memory leaks
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Cleanup interval: remove expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Extend globalThis to include our cleanup interval property
declare global {
  var _rateLimitCleanupInterval: NodeJS.Timeout | undefined;
}

// Start cleanup interval only if not already started (for hot reload in dev)
if (typeof globalThis._rateLimitCleanupInterval === "undefined") {
  globalThis._rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [ip, record] of rateLimitMap.entries()) {
      // Remove entries that have been expired for more than 1 hour
      if (now > record.resetTime + 60 * 60 * 1000) {
        rateLimitMap.delete(ip);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.info("[RateLimit] Cleaned up expired entries", {
        cleanedCount,
        remainingEntries: rateLimitMap.size,
      });
    }
  }, CLEANUP_INTERVAL_MS);

  // Clean up interval on process termination to prevent memory leaks
  const cleanupInterval = () => {
    if (globalThis._rateLimitCleanupInterval) {
      clearInterval(globalThis._rateLimitCleanupInterval);
      globalThis._rateLimitCleanupInterval = undefined;
      console.info("[RateLimit] Cleanup interval cleared on process termination");
    }
  };

  // Register cleanup handlers for various termination signals
  process.on("beforeExit", cleanupInterval);
  process.on("SIGINT", cleanupInterval);
  process.on("SIGTERM", cleanupInterval);
  process.on("uncaughtException", cleanupInterval);
}

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

    // Check for abort signal before starting the potentially long LLM call
    if (signal?.aborted) {
      throw new Error("Run cancelled");
    }

    // Create an abort controller that will be triggered by the parent signal
    const abortController = new AbortController();
    let onParentAbort: (() => void) | undefined;

    if (signal) {
      onParentAbort = () => abortController.abort();
      signal.addEventListener("abort", onParentAbort, { once: true });
    }

    const llmResponse = await retryWithBackoff(
      () => chat(
        modelId,
        messages,
        {
          temperature: 0.7,
          maxTokens: 65536, // 2x+ increase - models were stopping mid-output
          timeoutMs,
          abortSignal: abortController.signal, // Pass abort signal to chat
        },
        apiKeys
      ),
      {
        maxRetries: 3,
        baseDelay: 2000,
        onRetry: (attempt, error, delay) => {
          // Check abort before retrying
          if (signal?.aborted || abortController.signal.aborted) {
            throw new Error("Run cancelled");
          }
          console.warn(`[Run API] Retry ${attempt}/3 for model ${modelId}: ${error.message}. Next retry in ${delay}ms`);
        },
      }
    ).finally(() => {
      // Clean up event listener - use the stored reference
      if (onParentAbort && signal) {
        signal.removeEventListener("abort", onParentAbort);
      }
      // Also abort the controller to ensure any pending requests are cancelled
      abortController.abort();
    });

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
    // Check if this was a cancellation
    if (signal?.aborted || (error instanceof Error && error.message === "Run cancelled")) {
      console.info("[Run API] Model run cancelled for:", modelId);
      return {
        modelId,
        output: "",
        evaluation: null,
        error: "CANCELLED",
      };
    }

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

    // Create benchmark run and model run records in a single transaction
    // This prevents orphaned records if the server crashes between operations
    const { benchmarkRun, modelRuns } = await prisma.$transaction(async (tx) => {
      const run = await tx.benchmarkRun.create({
        data: {
          benchmarkId,
          evaluator: `${evaluatorProvider}:${evaluator}`,
          concurrency,
          timeoutSec,
          status: "RUNNING",
        },
      });

      const runs = await Promise.all(
        modelIds.map((modelId) =>
          tx.modelRun.create({
            data: {
              benchmarkRunId: run.id,
              modelId,
              status: "PENDING",
            },
          })
        )
      );

      return { benchmarkRun: run, modelRuns: runs };
    });

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
    // Get the AbortSignal from the request to support cancellation
    const signal = request.signal;

    // Set up a listener to detect if the client disconnects
    const onAbort = () => {
      console.info("[Run API] Request aborted by client", { benchmarkRunId: benchmarkRun.id });
    };
    signal.addEventListener("abort", onAbort);

    try {
      for (let i = 0; i < modelIds.length; i += concurrency) {
        // Check if request was aborted before starting next batch
        if (signal.aborted) {
          throw new Error("Benchmark run cancelled by user");
        }

        const batch = modelIds.slice(i, i + concurrency);
        const batchPromises = batch.map((modelId) =>
          executeModelRun(
            benchmark,
            modelId,
            categoriesToEvaluate,
            evaluator,
            evaluatorProvider,
            apiKeys,
            timeoutMs,
            signal  // Pass the abort signal through
          )
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
    } finally {
      // Clean up the abort listener
      signal.removeEventListener("abort", onAbort);
    }

    // Save results to database
    for (const result of results) {
      const modelRun = modelRuns.find((mr) => mr.modelId === result.modelId);
      if (!modelRun) continue;

      if (result.error) {
        // Check if this was a cancellation
        if (result.error === "CANCELLED") {
          await prisma.modelRun.update({
            where: { id: modelRun.id },
            data: {
              status: "CANCELLED",
              output: "Run cancelled by user",
              completedAt: new Date(),
            },
          });
          continue;
        }

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
    const hasSuccesses = results.some((r) => !r.error);
    const hasCancelled = results.some((r) => r.error === "CANCELLED");

    // Determine appropriate status based on results
    // Note: Using COMPLETED for partial failures since PARTIAL is not in the RunStatus enum
    // Consider adding PARTIAL status to schema for better tracking
    let finalStatus: "COMPLETED" | "FAILED" | "CANCELLED" = "FAILED";
    if (hasCancelled && !hasSuccesses) {
      finalStatus = "CANCELLED"; // All were cancelled
    } else if (hasSuccesses) {
      finalStatus = "COMPLETED"; // All successes or mixed (partial failures)
    } else {
      finalStatus = "FAILED"; // All models failed
    }

    await prisma.benchmarkRun.update({
      where: { id: benchmarkRun.id },
      data: {
        status: finalStatus,
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
