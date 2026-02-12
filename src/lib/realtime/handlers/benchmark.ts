/**
 * Benchmark Progress Handlers
 *
 * Progress tracking handlers for benchmark execution
 * Provides real-time updates during benchmark runs
 */

import { prisma } from "@/lib/prisma";
import {
  broadcastProgress,
  broadcastLog,
  broadcastComplete,
  broadcastError,
} from "@/lib/realtime/progress";

// Type definitions for progress tracking
// These match the types in @/lib/realtime/progress

/**
 * Initialize benchmark run progress tracking
 */
export async function initializeBenchmarkProgress(
  benchmarkRunId: string,
  totalSteps: number
): Promise<void> {
  // Log initialization
  await prisma.benchmarkLog.create({
    data: {
      benchmarkRunId,
      level: "info",
      message: "Benchmark initialization started",
      metadata: JSON.stringify({ totalSteps }),
    },
  });

  broadcastProgress({
    benchmarkRunId,
    stepName: "Initializing benchmark",
    stepNumber: 0,
    totalSteps,
    percentage: 0,
    status: "running",
  });

  broadcastLog({
    benchmarkRunId,
    level: "info",
    message: "Initializing benchmark run",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track model execution progress
 */
export async function trackModelExecution(
  benchmarkRunId: string,
  modelId: string,
  modelName: string,
  stepNumber: number,
  totalSteps: number
): Promise<void> {
  const percentage = (stepNumber / totalSteps) * 100;

  broadcastProgress({
    benchmarkRunId,
    stepName: `Running ${modelName}`,
    stepNumber,
    totalSteps,
    percentage,
    status: "running",
  });

  broadcastLog({
    benchmarkRunId,
    level: "info",
    message: `Executing model: ${modelName}`,
    timestamp: new Date().toISOString(),
  });

  // Store progress in database
  await prisma.benchmarkProgress.create({
    data: {
      benchmarkRunId,
      stepName: `Running ${modelName}`,
      stepNumber,
      totalSteps,
      status: "running",
      percentage,
      message: `Executing model: ${modelId}`,
    },
  });
}

/**
 * Track model evaluation progress
 */
export async function trackModelEvaluation(
  benchmarkRunId: string,
  modelId: string,
  modelName: string,
  stepNumber: number,
  totalSteps: number
): Promise<void> {
  const percentage = (stepNumber / totalSteps) * 100;

  broadcastProgress({
    benchmarkRunId,
    stepName: `Evaluating ${modelName}`,
    stepNumber,
    totalSteps,
    percentage,
    status: "running",
  });

  broadcastLog({
    benchmarkRunId,
    level: "info",
    message: `Evaluating output for: ${modelName}`,
    timestamp: new Date().toISOString(),
  });

  // Store progress in database
  await prisma.benchmarkProgress.create({
    data: {
      benchmarkRunId,
      stepName: `Evaluating ${modelName}`,
      stepNumber,
      totalSteps,
      status: "running",
      percentage,
      message: `Evaluating model: ${modelId}`,
    },
  });
}

/**
 * Mark benchmark as complete
 */
export async function completeBenchmark(benchmarkRunId: string, results: unknown): Promise<void> {
  broadcastProgress({
    benchmarkRunId,
    stepName: "Benchmark completed",
    stepNumber: 1,
    totalSteps: 1,
    percentage: 100,
    status: "completed",
  });

  broadcastLog({
    benchmarkRunId,
    level: "info",
    message: "Benchmark run completed successfully",
    timestamp: new Date().toISOString(),
  });

  broadcastComplete(benchmarkRunId, true, results);

  // Mark run as completed
  await prisma.benchmarkRun.update({
    where: { id: benchmarkRunId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

/**
 * Handle benchmark error
 */
export async function handleBenchmarkError(benchmarkRunId: string, error: Error): Promise<void> {
  broadcastLog({
    benchmarkRunId,
    level: "error",
    message: `Benchmark failed: ${error.message}`,
    timestamp: new Date().toISOString(),
  });

  broadcastError(benchmarkRunId, error.message);

  // Mark run as failed
  await prisma.benchmarkRun.update({
    where: { id: benchmarkRunId },
    data: { status: "FAILED", completedAt: new Date() },
  });

  // Store error log
  await prisma.benchmarkLog.create({
    data: {
      benchmarkRunId,
      level: "error",
      message: error.message,
      metadata: JSON.stringify({ stack: error.stack }),
    },
  });
}

/**
 * Handle model execution failure
 */
export async function handleModelFailure(
  benchmarkRunId: string,
  modelId: string,
  modelName: string,
  error: Error
): Promise<void> {
  broadcastLog({
    benchmarkRunId,
    level: "error",
    message: `Model ${modelName} failed: ${error.message}`,
    timestamp: new Date().toISOString(),
  });

  // Store error log
  await prisma.benchmarkLog.create({
    data: {
      benchmarkRunId,
      level: "error",
      message: `Model ${modelName} failed: ${error.message}`,
      metadata: JSON.stringify({ modelId, stack: error.stack }),
    },
  });
}

/**
 * Clean up old progress entries
 */
export async function cleanupOldProgress(days: number = 7): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  await prisma.benchmarkProgress.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  await prisma.benchmarkLog.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });
}
