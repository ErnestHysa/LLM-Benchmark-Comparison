/**
 * Analytics Calculators
 *
 * Utility functions for calculating metrics, costs, and statistics
 */

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface CostBreakdown {
  promptCost?: number;
  completionCost?: number;
  cacheCost?: number;
  totalCost: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheTokens?: number;
}

/**
 * Get model pricing for a given provider and model ID
 * Returns default pricing if no custom pricing is set
 */
export function getModelPricing(
  provider: string,
  modelId: string,
  pricingList?: Array<{ provider: string; modelId: string; inputPrice: number; outputPrice: number }>
): { inputPrice: number; outputPrice: number; contextPrice?: number } | null {
  // Check custom pricing first
  if (pricingList && pricingList.length > 0) {
    const custom = pricingList.find(
      (p) => p.provider === provider && p.modelId === modelId
    );
    if (custom) {
      return {
        inputPrice: custom.inputPrice,
        outputPrice: custom.outputPrice,
        contextPrice: custom.inputPrice, // Use input price for context
      };
    }
  }

  // Default pricing (pricing per 1M tokens)
  const defaults: Record<string, { inputPrice: number; outputPrice: number; contextPrice?: number }> = {
    openai: {
      inputPrice: 0.5,     // $0.50 per 1M input tokens
      outputPrice: 1.5,      // $1.50 per 1M output tokens
    },
    anthropic: {
      inputPrice: 0.3,     // $0.30 per 1M input tokens
      outputPrice: 1.5,      // $1.50 per 1M output tokens
      contextPrice: 0.3,    // Claude context tokens same price as input
    },
    openrouter: {
      // OpenRouter uses various provider pricing
      // Default to Claude/Anthropic rates
      inputPrice: 0.3,
      outputPrice: 1.5,
      contextPrice: 0.3,
    },
    custom: {
      // User-defined endpoints
      inputPrice: 0.2,
      outputPrice: 0.4,
    },
  };

  const providerKey = provider.toLowerCase();
  const pricing = defaults[providerKey as keyof typeof defaults] || defaults.custom;

  if (!pricing) {
    console.warn(`[Calculators] No pricing found for provider: ${provider}, model: ${modelId}`);
    return null;
  }

  return pricing;
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  pricing: { inputPrice: number; outputPrice: number; contextPrice?: number },
  usage: TokenUsage
): CostBreakdown {
  const inputCost = (usage.inputTokens || 0) * pricing.inputPrice / 1_000_000;
  const outputCost = (usage.outputTokens || 0) * pricing.outputPrice / 1_000_000;
  const contextPrice = pricing.contextPrice || pricing.outputPrice;
  const cacheCost =
    (usage.cacheReadTokens || 0) * contextPrice / 1_000_000 +
    (usage.cacheWriteTokens || 0) * contextPrice / 1_000_000;

  return {
    promptCost: inputCost + outputCost,
    completionCost: outputCost,
    cacheCost,
    totalCost: inputCost + outputCost + cacheCost,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheTokens: (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0),
  };
}

/**
 * Calculate statistics from an array of values
 */
export interface StatsSummary {
  avg: number;
  min: number;
  max: number;
  count: number;
  sum: number;
}

export function calculateStats(values: number[]): StatsSummary {
  if (!values || values.length === 0) {
    return { avg: 0, min: 0, max: 0, count: 0, sum: 0 };
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { avg, min, max, count: values.length, sum };
}

/**
 * Calculate percentile from sorted array of values
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get model display name from model ID
 */
export function getModelDisplayName(modelId: string, customModels?: Array<{ id: string; name: string }>): string {
  // Check custom models first
  if (customModels) {
    const custom = customModels.find((m) => m.id === modelId);
    if (custom) return custom.name;
  }

  // Predefined model names
  const modelNames: Record<string, string> = {
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-5-sonnet-20240207': 'Claude 3.5 Sonnet (Short)',
    'claude-3-opus-20240207': 'Claude 3 Opus',
    'claude-3-haiku-20240307': 'Claude 3 Haiku',
    'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
    'gemini-2.0-flash-thinking-exp': 'Gemini 1.5 Pro',
    'deepseek-chat': 'DeepSeek Chat',
    'deepseek-coder': 'DeepSeek Coder',
    'llama-3.1-70b-instruct': 'Llama 3.1 70B',
    'mistral-7b-instruct': 'Mistral 7B',
    'mixtral-8x7b-instruct': 'Mixtral 8x7B',
  };

  return modelNames[modelId] || modelId;
}

/**
 * Extract provider from model ID
 */
export function getProviderFromModelId(modelId: string): string {
  const parts = modelId.split(':');
  return parts[0] || 'unknown';
}

/**
 * Group runs by time period
 */
export interface TimePeriod {
  start: Date;
  end: Date;
  label: string;
}

export function getTimePeriods(lastDays: number = 30): TimePeriod[] {
  const periods: TimePeriod[] = [];
  const now = new Date();

  for (let i = 0; i < lastDays; i++) {
    const end = new Date(now);
    end.setDate(end.getDate() - i);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);

    let label = `${lastDays} days ago`;
    if (i === 0) label = '24h';
    else if (i === 6) label = '7d';
    else if (i === 29) label = '30d';
    else if (i === 89) label = '90d';

    periods.push({ start, end, label });
  }

  // Add "all time" option
  periods.unshift({
    start: new Date(0),
    end: now,
    label: 'All',
  });

  return periods;
}
