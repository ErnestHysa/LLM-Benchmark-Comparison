/**
 * Batch Configuration Manager
 *
 * Manages saved batch configurations for reuse
 */

import { prisma } from '@/lib/prisma';
import type { CreateBatchRequest, ScheduleConfig, BatchValidationResult, ValidationError } from './types';

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

/**
 * Create a new batch configuration
 */
export async function createBatchConfig(config: CreateBatchRequest) {
  const validation = validateBatchConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid batch configuration: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  return prisma.batchConfig.create({
    data: {
      name: config.name,
      benchmarkIds: JSON.stringify(config.benchmarkIds),
      modelIds: JSON.stringify(config.modelIds),
      evaluatorModel: config.evaluatorModel,
      evaluatorProvider: config.evaluatorProvider,
      concurrency: config.concurrency || 5,
      scheduleConfig: config.scheduleConfig ? JSON.stringify(config.scheduleConfig) : null,
      isActive: true,
    },
  });
}

/**
 * Get all batch configurations
 */
export async function getBatchConfigs() {
  const configs = await prisma.batchConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return configs.map(config => ({
    ...config,
    benchmarkIds: JSON.parse(config.benchmarkIds) as string[],
    modelIds: JSON.parse(config.modelIds) as string[],
    scheduleConfig: config.scheduleConfig ? JSON.parse(config.scheduleConfig) as ScheduleConfig : undefined,
  }));
}

/**
 * Get batch configuration by ID
 */
export async function getBatchConfig(id: string) {
  const config = await prisma.batchConfig.findUnique({
    where: { id },
  });

  if (!config) {
    return null;
  }

  return {
    ...config,
    benchmarkIds: JSON.parse(config.benchmarkIds) as string[],
    modelIds: JSON.parse(config.modelIds) as string[],
    scheduleConfig: config.scheduleConfig ? JSON.parse(config.scheduleConfig) as ScheduleConfig : undefined,
  };
}

/**
 * Update batch configuration
 */
export async function updateBatchConfig(
  id: string,
  updates: Partial<CreateBatchRequest>
) {
  const validation = validateBatchConfig(updates);
  if (!validation.valid) {
    throw new Error(`Invalid batch configuration: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  const data: any = {};

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.benchmarkIds !== undefined) data.benchmarkIds = JSON.stringify(updates.benchmarkIds);
  if (updates.modelIds !== undefined) data.modelIds = JSON.stringify(updates.modelIds);
  if (updates.evaluatorModel !== undefined) data.evaluatorModel = updates.evaluatorModel;
  if (updates.evaluatorProvider !== undefined) data.evaluatorProvider = updates.evaluatorProvider;
  if (updates.concurrency !== undefined) data.concurrency = updates.concurrency;
  if (updates.scheduleConfig !== undefined) {
    data.scheduleConfig = updates.scheduleConfig ? JSON.stringify(updates.scheduleConfig) : null;
  }

  return prisma.batchConfig.update({
    where: { id },
    data,
  });
}

/**
 * Delete batch configuration
 */
export async function deleteBatchConfig(id: string): Promise<void> {
  await prisma.batchConfig.delete({
    where: { id },
  });
}

/**
 * Toggle batch configuration active status
 */
export async function toggleBatchConfig(id: string, isActive: boolean) {
  return prisma.batchConfig.update({
    where: { id },
    data: { isActive },
  });
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate batch configuration
 */
export function validateBatchConfig(config: Partial<CreateBatchRequest>): BatchValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Name validation
  if (config.name !== undefined) {
    if (!config.name || config.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required' });
    } else if (config.name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be less than 100 characters' });
    }
  }

  // Benchmark IDs validation
  if (config.benchmarkIds !== undefined) {
    if (!Array.isArray(config.benchmarkIds)) {
      errors.push({ field: 'benchmarkIds', message: 'Benchmark IDs must be an array' });
    } else if (config.benchmarkIds.length === 0) {
      errors.push({ field: 'benchmarkIds', message: 'At least one benchmark is required' });
    } else if (config.benchmarkIds.length > 50) {
      warnings.push('Running more than 50 benchmarks may take a long time');
    }
  }

  // Model IDs validation
  if (config.modelIds !== undefined) {
    if (!Array.isArray(config.modelIds)) {
      errors.push({ field: 'modelIds', message: 'Model IDs must be an array' });
    } else if (config.modelIds.length === 0) {
      errors.push({ field: 'modelIds', message: 'At least one model is required' });
    } else if (config.modelIds.length > 20) {
      warnings.push('Running more than 20 models may take a long time');
    }
  }

  // Evaluator validation
  if (config.evaluatorModel !== undefined) {
    if (!config.evaluatorModel || config.evaluatorModel.trim().length === 0) {
      errors.push({ field: 'evaluatorModel', message: 'Evaluator model is required' });
    }
  }

  if (config.evaluatorProvider !== undefined) {
    const validProviders = ['openai', 'anthropic', 'openrouter', 'custom'];
    if (!validProviders.includes(config.evaluatorProvider)) {
      errors.push({
        field: 'evaluatorProvider',
        message: `Evaluator provider must be one of: ${validProviders.join(', ')}`,
      });
    }
  }

  // Concurrency validation
  if (config.concurrency !== undefined) {
    if (typeof config.concurrency !== 'number') {
      errors.push({ field: 'concurrency', message: 'Concurrency must be a number' });
    } else if (config.concurrency < 1) {
      errors.push({ field: 'concurrency', message: 'Concurrency must be at least 1' });
    } else if (config.concurrency > 20) {
      errors.push({ field: 'concurrency', message: 'Concurrency cannot exceed 20' });
    }
  }

  // Timeout validation
  if (config.timeoutSec !== undefined) {
    if (typeof config.timeoutSec !== 'number') {
      errors.push({ field: 'timeoutSec', message: 'Timeout must be a number' });
    } else if (config.timeoutSec < 10) {
      errors.push({ field: 'timeoutSec', message: 'Timeout must be at least 10 seconds' });
    } else if (config.timeoutSec > 3600) {
      errors.push({ field: 'timeoutSec', message: 'Timeout cannot exceed 1 hour' });
    }
  }

  // Schedule config validation
  if (config.scheduleConfig !== undefined) {
    const scheduleErrors = validateScheduleConfig(config.scheduleConfig);
    errors.push(...scheduleErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate schedule configuration
 */
function validateScheduleConfig(config: ScheduleConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.type) {
    errors.push({ field: 'scheduleConfig.type', message: 'Schedule type is required' });
  } else {
    const validTypes = ['manual', 'daily', 'weekly', 'cron'];
    if (!validTypes.includes(config.type)) {
      errors.push({
        field: 'scheduleConfig.type',
        message: `Schedule type must be one of: ${validTypes.join(', ')}`,
      });
    }
  }

  if (config.type === 'cron' && !config.cronExpression) {
    errors.push({ field: 'scheduleConfig.cronExpression', message: 'Cron expression is required for cron schedules' });
  }

  if (config.type === 'daily' || config.type === 'weekly') {
    if (!config.runAt || !/^\d{2}:\d{2}$/.test(config.runAt)) {
      errors.push({
        field: 'scheduleConfig.runAt',
        message: 'Run time must be in HH:MM format for daily/weekly schedules',
      });
    }
  }

  return errors;
}

// ============================================
// ESTIMATION
// ============================================

/**
 * Estimate batch execution time
 */
export function estimateBatchExecutionTime(
  benchmarkCount: number,
  modelCount: number,
  concurrency: number
): {
  estimatedMinutes: number;
  estimatedRunsPerMinute: number;
  totalRuns: number;
} {
  const totalRuns = benchmarkCount * modelCount;
  const avgTimePerRun = 2; // Average 2 minutes per run (LLM + evaluation)
  const runsPerMinute = concurrency / avgTimePerRun;
  const estimatedMinutes = Math.ceil(totalRuns / runsPerMinute);

  return {
    estimatedMinutes,
    estimatedRunsPerMinute: Math.floor(runsPerMinute),
    totalRuns,
  };
}

/**
 * Estimate batch cost
 */
export function estimateBatchCost(
  benchmarkCount: number,
  modelCount: number,
  avgTokensPerRun: number = 5000
): {
  estimatedCost: number;
  estimatedTokens: number;
  totalRuns: number;
} {
  // Rough cost estimates (in USD per million tokens)
  const inputCostPerMillion = 0.005; // $5 per million
  const outputCostPerMillion = 0.015; // $15 per million
  const evaluatorCostPerMillion = 0.003; // $3 per million

  const totalRuns = benchmarkCount * modelCount;
  const estimatedTokens = totalRuns * avgTokensPerRun;
  const estimatedInputCost = (estimatedTokens * inputCostPerMillion) / 1_000_000;
  const estimatedOutputCost = (estimatedTokens * outputCostPerMillion) / 1_000_000;
  const estimatedEvaluatorCost = (estimatedTokens * evaluatorCostPerMillion) / 1_000_000;

  const estimatedCost = estimatedInputCost + estimatedOutputCost + estimatedEvaluatorCost;

  return {
    estimatedCost,
    estimatedTokens,
    totalRuns,
  };
}
