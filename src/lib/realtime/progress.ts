/**
 * Progress Broadcasting Utilities
 *
 * Functions to broadcast progress updates to connected SSE clients
 */

import type { ProgressData, LogData } from "./sse";
import { getEmitter } from "./sse";

/**
 * Broadcast a progress update to all connected clients for a benchmark run
 * @param data - The progress data to broadcast
 */
export function broadcastProgress(data: ProgressData): void {
  const emitter = getEmitter(data.benchmarkRunId);
  emitter.progress(data);
  console.info(
    `[Progress] ${data.stepName} (${data.stepNumber}/${data.totalSteps}) - ${data.percentage.toFixed(1)}%`
  );
}

/**
 * Broadcast a log entry to all connected clients for a benchmark run
 * @param data - The log data to broadcast
 */
export function broadcastLog(data: LogData): void {
  const emitter = getEmitter(data.benchmarkRunId);
  emitter.log({
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  });
  console.info(`[Log:${data.level.toUpperCase()}] ${data.message}`);
}

/**
 * Broadcast a completion event to all connected clients for a benchmark run
 * @param benchmarkRunId - The benchmark run ID
 * @param success - Whether the run completed successfully
 * @param results - Optional results data
 * @param error - Optional error message if failed
 */
export function broadcastComplete(
  benchmarkRunId: string,
  success: boolean,
  results?: unknown,
  error?: string
): void {
  const emitter = getEmitter(benchmarkRunId);
  emitter.complete({
    benchmarkRunId,
    success,
    results,
    error,
  });
  console.info(`[Complete] Benchmark ${benchmarkRunId} - ${success ? "SUCCESS" : "FAILED"}`);
}

/**
 * Broadcast an error event to all connected clients for a benchmark run
 * @param benchmarkRunId - The benchmark run ID
 * @param error - Error message
 * @param metadata - Optional metadata
 */
export function broadcastError(
  benchmarkRunId: string,
  error: string,
  metadata?: Record<string, unknown>
): void {
  const emitter = getEmitter(benchmarkRunId);
  const errorMessage = metadata ? `${error}: ${JSON.stringify(metadata)}` : error;
  emitter.error(errorMessage);
  console.error(`[Error] Benchmark ${benchmarkRunId} - ${error}`);
}

/**
 * Broadcast a model start event
 * @param benchmarkRunId - The benchmark run ID
 * @param modelName - Name of the model being started
 * @param modelIndex - Index of the model
 * @param totalModels - Total number of models
 * @param modelProvider - Provider of the model (optional)
 */
export function broadcastModelStart(
  benchmarkRunId: string,
  modelName: string,
  modelIndex: number,
  totalModels: number,
  modelProvider?: string,
  benchmarkName?: string
): void {
  broadcastProgress({
    benchmarkRunId,
    stepName: `Running ${modelName}`,
    stepNumber: modelIndex,
    totalSteps: totalModels,
    percentage: (modelIndex / totalModels) * 100,
    status: "running",
    message: `Starting ${modelName}...`,
    modelName,
    modelProvider,
    currentModelIndex: modelIndex,
    totalModels,
    currentModel: modelName,
    currentBenchmark: benchmarkName,
  });
}

/**
 * Broadcast a model complete event
 * @param benchmarkRunId - The benchmark run ID
 * @param modelName - Name of the model that completed
 * @param modelIndex - Index of the model
 * @param totalModels - Total number of models
 * @param score - Optional score
 * @param modelProvider - Provider of the model (optional)
 * @param benchmarkName - Name of the benchmark (optional)
 */
export function broadcastModelComplete(
  benchmarkRunId: string,
  modelName: string,
  modelIndex: number,
  totalModels: number,
  score?: number,
  modelProvider?: string,
  benchmarkName?: string
): void {
  broadcastProgress({
    benchmarkRunId,
    stepName: `Completed ${modelName}`,
    stepNumber: modelIndex,
    totalSteps: totalModels,
    percentage: (modelIndex / totalModels) * 100,
    status: "completed",
    message: score ? `Score: ${score.toFixed(1)}%` : "Completed",
    modelName,
    modelProvider,
    currentModelIndex: modelIndex,
    totalModels,
    currentModel: modelName,
    currentBenchmark: benchmarkName,
  });
}

/**
 * Broadcast a model failure event
 * @param benchmarkRunId - The benchmark run ID
 * @param modelName - Name of the model that failed
 * @param modelIndex - Index of the model
 * @param totalModels - Total number of models
 * @param error - Error message
 * @param modelProvider - Provider of the model (optional)
 * @param benchmarkName - Name of the benchmark (optional)
 */
export function broadcastModelFailure(
  benchmarkRunId: string,
  modelName: string,
  modelIndex: number,
  totalModels: number,
  error: string,
  modelProvider?: string,
  benchmarkName?: string
): void {
  broadcastLog({
    benchmarkRunId,
    level: "error",
    message: `${modelName} failed: ${error}`,
    timestamp: new Date().toISOString(),
  });
  broadcastProgress({
    benchmarkRunId,
    stepName: `Failed ${modelName}`,
    stepNumber: modelIndex,
    totalSteps: totalModels,
    percentage: (modelIndex / totalModels) * 100,
    status: "failed",
    message: `${modelName} failed`,
    modelName,
    modelProvider,
    currentModelIndex: modelIndex,
    totalModels,
    currentModel: modelName,
    currentBenchmark: benchmarkName,
  });
}

/**
 * Broadcast an evaluation start event
 * @param benchmarkRunId - The benchmark run ID
 * @param modelName - Name of the model being evaluated
 */
export function broadcastEvaluationStart(benchmarkRunId: string, modelName: string): void {
  broadcastLog({
    benchmarkRunId,
    level: "info",
    message: `Evaluating ${modelName}...`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast initialization complete
 * @param benchmarkRunId - The benchmark run ID
 * @param totalSteps - Total number of steps in the benchmark
 */
export function broadcastInitialization(benchmarkRunId: string, totalSteps: number): void {
  broadcastProgress({
    benchmarkRunId,
    stepName: "Initializing benchmark",
    stepNumber: 0,
    totalSteps,
    percentage: 0,
    status: "pending",
    message: "Preparing to run benchmark...",
  });
}
