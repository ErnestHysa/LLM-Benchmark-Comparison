/**
 * Batch Executor with Real-Time Progress
 *
 * Executes multiple benchmarks against multiple models with detailed SSE progress
 */

import { prisma } from '@/lib/prisma';
import { chat } from '@/lib/llm';
import { evaluateOutput } from '@/lib/llm/evaluator';
import { retryWithBackoff } from '@/lib/utils/retry';
import { classifyBenchmarkError, getBenchmarkErrorMessage } from '@/lib/utils/errors';
import {
  broadcastProgress,
  broadcastComplete,
  broadcastError,
  closeEmitter,
} from '@/lib/realtime';

// ============================================
// TYPES
// ============================================

export interface BatchConfig {
  benchmarkIds: string[];
  modelIds: string[];
  evaluatorModel: string;
  evaluatorProvider: string;
  concurrency: number;
  timeoutSec?: number;
  apiKeys?: Record<string, string>;
}

export interface BatchProgress {
  batchId: string;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  currentBenchmark?: string;
  currentModel?: string;
  percentage: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  message?: string;
}

export interface BatchResult {
  batchId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  results: BatchRunResult[];
  startedAt: Date;
  completedAt?: Date;
}

export interface BatchRunResult {
  benchmarkId: string;
  benchmarkName: string;
  modelId: string;
  modelName: string;
  status: 'COMPLETED' | 'FAILED' | 'TIMEOUT';
  score?: number;
  tokensUsed?: number;
  cost?: number;
  duration?: number;
  errorMessage?: string;
  categoryScores?: Array<{
    category: string;
    score: number;
    metrics: Array<{ name: string; score: number }>;
  }>;
}

export interface BenchmarkWithCategory {
  id: string;
  name: string;
  prompt: string;
  primaryCategory: string;
}

interface QueuedRun {
  benchmark: BenchmarkWithCategory;
  modelId: string;
  modelName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
}

// ============================================
// BATCH EXECUTION
// ============================================

/**
 * Execute a batch of benchmarks against multiple models
 */
export async function executeBatch(
  batchConfig: BatchConfig,
  onProgress?: (progress: BatchProgress) => void,
  signal?: AbortSignal
): Promise<BatchResult> {
  const {
    benchmarkIds,
    modelIds,
    evaluatorModel,
    evaluatorProvider,
    concurrency,
    timeoutSec = 600,
    apiKeys,
  } = batchConfig;

  console.info('[BatchExecutor] Starting batch execution:', {
    benchmarkCount: benchmarkIds.length,
    modelCount: modelIds.length,
    totalRuns: benchmarkIds.length * modelIds.length,
    concurrency,
    timeoutSec,
  });

  // Fetch all benchmarks
  const benchmarks = await prisma.benchmark.findMany({
    where: { id: { in: benchmarkIds } },
    select: {
      id: true,
      name: true,
      prompt: true,
      primaryCategory: true,
    },
  });

  if (benchmarks.length === 0) {
    throw new Error('No valid benchmarks found');
  }

  if (benchmarks.length !== benchmarkIds.length) {
    console.warn('[BatchExecutor] Some benchmarks not found:', {
      requested: benchmarkIds.length,
      found: benchmarks.length,
    });
  }

  // Create batch record with SSE progressId
  const totalRuns = benchmarks.length * modelIds.length;
  const batch = await prisma.benchmarkBatch.create({
    data: {
      name: `Batch-${Date.now()}`,
      benchmarkIds: JSON.stringify(benchmarkIds),
      modelIds: JSON.stringify(modelIds),
      evaluatorModel,
      evaluatorProvider,
      concurrency,
      status: 'RUNNING',
      totalRuns,
      completedRuns: 0,
      failedRuns: 0,
      startedAt: new Date(),
    },
  });

  const batchId = batch.id;

  // Initial progress
  onProgress?.({
    batchId,
    totalRuns,
    completedRuns: 0,
    failedRuns: 0,
    percentage: 0,
    status: 'RUNNING',
    message: 'Initializing batch execution...',
  });

  const results: BatchRunResult[] = [];
  let completedRuns = 0;
  // failedRuns is calculated as totalRuns - completedRuns

  // Create a queue of all runs
  const queue: QueuedRun[] = [];

  for (const benchmark of benchmarks) {
    for (const modelId of modelIds) {
      queue.push({
        benchmark,
        modelId,
        modelName: modelId, // Use model ID as name for now
        status: 'pending',
      });
    }
  }

  // Process queue with concurrency
  let processedCount = 0;

  try {
    for (let i = 0; i < queue.length; i += concurrency) {
      // Check for abort
      if (signal?.aborted) {
        console.info('[BatchExecutor] Batch execution aborted');
        const failedRuns = totalRuns - completedRuns;
        await updateBatchStatus(batchId, 'FAILED', completedRuns, failedRuns);
        broadcastError(batchId, 'Batch execution cancelled');
        closeEmitter(batchId);
        throw new Error('Batch execution cancelled');
      }

      // Get batch for this group
      const currentBatch = queue.slice(i, i + concurrency);
      const batchNum = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(queue.length / concurrency);

      // Broadcast batch progress
      broadcastProgress({
        benchmarkRunId: batchId,
        stepName: `Batch ${batchNum}/${totalBatches}`,
        stepNumber: batchNum - 1,
        totalSteps: totalBatches,
        percentage: ((batchNum - 1) / totalBatches) * 100,
        status: 'running',
        message: `Running ${currentBatch.length} benchmark(s)...`,
      });

      // Process current batch in parallel
      const batchPromises = currentBatch.map((queuedRun, idx) =>
        executeQueuedRun(queuedRun, batchId, {
          queuePosition: i + idx,
          totalInQueue: queue.length,
          onProgress: (data) => {
            // Update queue status
            const queueIdx = queue.findIndex(
              q => q.benchmark.id === queuedRun.benchmark.id && q.modelId === queuedRun.modelId
            );
            if (queueIdx !== -1) {
              queue[queueIdx] = { ...queue[queueIdx], ...data };
            }
            // Broadcast overall progress
            const totalProgress = (completedRuns / totalRuns) * 100;
            broadcastProgress({
              benchmarkRunId: batchId,
              stepName: `Running ${queuedRun.benchmark.name}`,
              stepNumber: processedCount + idx,
              totalSteps: totalRuns,
              percentage: totalProgress,
              status: 'running',
              message: data.message,
            });
          },
        }, signal, apiKeys, timeoutSec * 1000, evaluatorModel, evaluatorProvider
      ).then(result => {
        processedCount++;
        completedRuns++;

        // Update queue item
        const queueIdx = queue.findIndex(
          q => q.benchmark.id === result.benchmarkId && q.modelId === result.modelId
        );
        if (queueIdx !== -1) {
          queue[queueIdx] = {
            ...queue[queueIdx],
            status: result.status === 'COMPLETED' ? 'completed' : 'failed',
            progress: result.status === 'COMPLETED' ? 100 : undefined,
          };
        }

        results.push(result);

        // Update database progress
        const currentFailedRuns = totalRuns - completedRuns;
        updateBatchProgress(batchId, completedRuns, currentFailedRuns);

        return result;
      })
      );

      await Promise.all(batchPromises);
    }

    // Determine final status
    let finalStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED' = 'FAILED';
    if (completedRuns === totalRuns) {
      finalStatus = 'COMPLETED';
    } else if (completedRuns > 0) {
      finalStatus = 'PARTIAL';
    }

    // Update batch record
    await prisma.benchmarkBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        completedRuns,
        failedRuns: totalRuns - completedRuns,
        completedAt: new Date(),
      },
    });

    // Save batch results
    await saveBatchResults(batchId, results);

    // Final progress
    const finalProgress: BatchProgress = {
      batchId,
      totalRuns,
      completedRuns,
      failedRuns: totalRuns - completedRuns,
      percentage: 100,
      status: finalStatus,
      message: `Batch ${finalStatus.toLowerCase()}`,
    };

    onProgress?.(finalProgress);
    broadcastComplete(batchId, { success: finalStatus === 'COMPLETED', finalStatus, results });

    console.info('[BatchExecutor] Batch execution complete:', {
      batchId,
      status: finalStatus,
      completedRuns,
      failedRuns: totalRuns - completedRuns,
    });

    const finalResult: BatchResult = {
      batchId,
      status: finalStatus,
      totalRuns,
      completedRuns,
      failedRuns: totalRuns - completedRuns,
      results,
      startedAt: batch.startedAt,
      completedAt: new Date(),
    };

    return finalResult;
  } catch (error) {
    console.error('[BatchExecutor] Batch execution failed:', error);

    await prisma.benchmarkBatch.update({
      where: { id: batchId },
      data: {
        status: 'FAILED',
        completedRuns,
        failedRuns: totalRuns - completedRuns,
        completedAt: new Date(),
      },
    });

    broadcastError(batchId, error instanceof Error ? error.message : String(error));
    closeEmitter(batchId);

    throw error;
  }
}

/**
 * Execute a single queued run with detailed progress
 */
async function executeQueuedRun(
  queuedRun: QueuedRun,
  batchId: string,
  options: {
    queuePosition: number;
    totalInQueue: number;
    onProgress: (data: { status: 'running' | 'completed' | 'failed'; message?: string }) => void;
  },
  signal?: AbortSignal,
  apiKeys?: Record<string, string>,
  timeoutMs: number,
  evaluatorModel: string,
  evaluatorProvider: string
): Promise<BatchRunResult> {
  const { benchmark, modelId, modelName } = queuedRun;
  const startTime = Date.now();

  console.info('[BatchExecutor] Executing:', {
    benchmark: benchmark.name,
    model: modelName,
    position: options.queuePosition + 1,
    total: options.totalInQueue,
  });

  try {
    // Notify starting
    options.onProgress({
      status: 'running',
      message: `Starting ${benchmark.name}...`,
    });

    // Step 1: Get LLM output
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful AI assistant. Provide a complete, accurate response.',
      },
      { role: 'user' as const, content: benchmark.prompt },
    ];

    options.onProgress({
      status: 'running',
      message: `Running ${modelName}...`,
    });

    const abortController = new AbortController();
    let onParentAbort: (() => void) | undefined;

    if (signal) {
      onParentAbort = () => abortController.abort();
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const llmResponse = await retryWithBackoff(
        () =>
          chat(modelId, messages, {
            temperature: 0.7,
            maxTokens: 65536,
            timeoutMs,
            abortSignal: abortController.signal,
          }, apiKeys),
        {
          maxRetries: 3,
          baseDelay: 2000,
          onRetry: (attempt, error) => {
            console.warn(`[BatchExecutor] Retry ${attempt}/3 for ${modelId}:`, error.message);
          },
        }
      ).finally(() => {
        if (onParentAbort && signal) {
          signal.removeEventListener('abort', onParentAbort);
        }
        abortController.abort();
      });

      // Check for abort
      if (signal?.aborted) {
        return {
          benchmarkId: benchmark.id,
          benchmarkName: benchmark.name,
          modelId,
          modelName,
          status: 'FAILED',
          errorMessage: 'Run cancelled',
          duration: Date.now() - startTime,
        };
      }

      // Step 2: Evaluate output
      options.onProgress({
        status: 'running',
        message: `Evaluating ${modelName}...`,
      });

      const categories = [benchmark.primaryCategory];
      const evaluation = await evaluateOutput({
        modelId,
        output: llmResponse.content,
        prompt: benchmark.prompt,
        categories,
        evaluatorModelId: evaluatorModel,
        evaluatorProvider: evaluatorProvider.toLowerCase() as any,
        evaluatorApiKey: apiKeys?.[evaluatorProvider.toLowerCase()],
        benchmarkId: benchmark.id,
      });

      const duration = Date.now() - startTime;

      return {
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name,
        modelId,
        modelName,
        status: 'COMPLETED',
        score: evaluation.totalScore,
        tokensUsed: llmResponse.tokensUsed,
        duration,
        categoryScores: evaluation.categoryEvaluations.map((cat) => ({
          category: cat.category,
          score: cat.totalScore,
          metrics: cat.metrics.map((m) => ({
            name: m.name,
            score: m.score,
          })),
        })),
      };
    } catch (llmError) {
      const duration = Date.now() - startTime;
      const errorType = classifyBenchmarkError(llmError);
      const errorMessage = getBenchmarkErrorMessage(errorType, modelName);

      return {
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name,
        modelId,
        modelName,
        status: llmError instanceof Error && llmError.message.includes('timeout') ? 'TIMEOUT' : 'FAILED',
        errorMessage,
        duration,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      benchmarkId: benchmark.id,
      benchmarkName: benchmark.name,
      modelId,
      modelName,
      status: 'FAILED',
      errorMessage,
      duration,
    };
  }
}

/**
 * Update batch progress in database
 */
async function updateBatchProgress(
  batchId: string,
  completedRuns: number,
  failedRuns: number
): Promise<void> {
  await prisma.benchmarkBatch.update({
    where: { id: batchId },
    data: { completedRuns, failedRuns },
  });
}

/**
 * Save batch results to database
 */
async function saveBatchResults(
  batchId: string,
  results: BatchRunResult[]
): Promise<void> {
  console.info('[BatchExecutor] Saving batch results:', {
    batchId,
    resultCount: results.length,
  });

  for (const result of results) {
    await prisma.batchRunResult.create({
      data: {
        benchmarkRunId: batchId,
        benchmarkId: result.benchmarkId,
        benchmarkName: result.benchmarkName,
        modelId: result.modelId,
        modelName: result.modelName,
        status: result.status,
        score: result.score,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        duration: result.duration,
        errorMessage: result.errorMessage,
        startedAt: new Date(Date.now() - (result.duration || 0)),
        completedAt: new Date(),
        metadata: result.categoryScores ? JSON.stringify(result.categoryScores) : null,
      },
    });
  }
}

// ============================================
// BATCH MANAGEMENT
// ============================================

/**
 * Get batch by ID with results
 */
export async function getBatch(batchId: string) {
  return prisma.benchmarkBatch.findUnique({
    where: { id: batchId },
    include: {
      batchRuns: true,
    },
  });
}

/**
 * Get all batches
 */
export async function getBatches(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};

  if (options?.status) {
    where.status = options.status;
  }

  return prisma.benchmarkBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit,
    skip: options?.offset,
  });
}

/**
 * Get batch results
 */
export async function getBatchResults(batchId: string) {
  return prisma.batchRunResult.findMany({
    where: { benchmarkRunId: batchId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Cancel a running batch
 */
export async function cancelBatch(batchId: string): Promise<void> {
  await prisma.benchmarkBatch.update({
    where: { id: batchId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
    },
  });

  closeEmitter(batchId);
}

/**
 * Delete batch by ID
 */
export async function deleteBatch(batchId: string): Promise<void> {
  await prisma.benchmarkBatch.delete({
    where: { id: batchId },
  });
}

/**
 * Calculate rankings from batch results
 */
export function calculateRankings(results: BatchRunResult[]): Map<string, number> {
  const modelScores = new Map<string, { totalScore: number; count: number }>();

  for (const result of results) {
    if (result.status === 'COMPLETED' && result.score !== undefined) {
      const current = modelScores.get(result.modelId) || { totalScore: 0, count: 0 };
      current.totalScore += result.score;
      current.count += 1;
      modelScores.set(result.modelId, current);
    }
  }

  const averages = Array.from(modelScores.entries()).map(([modelId, { totalScore, count }]) => ({
    modelId,
    avgScore: count > 0 ? totalScore / count : 0,
  }));

  averages.sort((a, b) => b.avgScore - a.avgScore);

  const rankings = new Map<string, number>();
  for (let i = 0; i < averages.length; i++) {
    rankings.set(averages[i].modelId, i + 1);
  }

  return rankings;
}
