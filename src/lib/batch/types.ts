/**
 * Batch Types
 *
 * Shared types for batch operations
 */

import type { RunStatus } from '@prisma/client';

// ============================================
// BATCH REQUEST TYPES
// ============================================

export interface CreateBatchRequest {
  name: string;
  description?: string;
  benchmarkIds: string[];
  modelIds: string[];
  evaluatorModel: string;
  evaluatorProvider: 'openai' | 'anthropic' | 'openrouter' | 'custom';
  concurrency?: number;
  timeoutSec?: number;
  scheduleConfig?: ScheduleConfig;
}

export interface ScheduleConfig {
  type: 'manual' | 'daily' | 'weekly' | 'cron';
  cronExpression?: string;
  timezone?: string;
  runAt?: string; // HH:MM format for daily/weekly
}

// ============================================
// BATCH STATUS TYPES
// ============================================

export type BatchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface BatchStatusUpdate {
  batchId: string;
  status: BatchStatus;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  currentBenchmark?: string;
  currentModel?: string;
  percentage: number;
  message?: string;
  timestamp: Date;
}

// ============================================
// BATCH RESULT TYPES
// ============================================

export interface BatchResultSummary {
  batchId: string;
  status: BatchStatus;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  avgScore?: number;
  bestModel?: {
    modelId: string;
    modelName: string;
    avgScore: number;
  };
  worstModel?: {
    modelId: string;
    modelName: string;
    avgScore: number;
  };
  duration?: number; // milliseconds
  startedAt: Date;
  completedAt?: Date;
}

export interface BatchRunDetail {
  id: string;
  benchmarkId: string;
  benchmarkName: string;
  modelId: string;
  modelName: string;
  status: RunStatus;
  score?: number;
  tokensUsed?: number;
  cost?: number;
  duration?: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  categoryScores?: CategoryScoreDetail[];
}

export interface CategoryScoreDetail {
  category: string;
  score: number;
  metrics: MetricScoreDetail[];
}

export interface MetricScoreDetail {
  name: string;
  score: number;
  confidence: number;
  reasoning?: string;
}

// ============================================
// BATCH COMPARISON TYPES
// ============================================

export interface ModelComparison {
  modelId: string;
  modelName: string;
  totalRuns: number;
  successfulRuns: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  avgDuration: number;
  avgTokens: number;
  totalCost: number;
}

export interface BenchmarkComparison {
  benchmarkId: string;
  benchmarkName: string;
  category: string;
  modelComparisons: ModelComparison[];
  winner: {
    modelId: string;
    modelName: string;
    avgScore: number;
  };
}

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface BatchValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}
