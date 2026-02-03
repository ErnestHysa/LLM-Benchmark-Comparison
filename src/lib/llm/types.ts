/**
 * Shared types for LLM service layer
 */

export type MessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  timeoutMs?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  finishReason?: "stop" | "length" | "content_filter" | "max_tokens";
}

export interface LLMError {
  code: string;
  message: string;
  type: "rate_limit" | "invalid_request" | "api_error" | "timeout";
  retryable: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    "rate_limit_exceeded",
    "rate_limit_error",
    "timeout",
    "internal_error",
    "overloaded",
    "503",
    "502",
    "504",
  ],
};

export interface RateLimitConfig {
  maxRequests: number;
  perMilliseconds: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  perMilliseconds: 60000, // 1 minute
};

export type ModelProvider = "openai" | "anthropic" | "openrouter" | "custom";

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  name: string;
  supportsStreaming: boolean;
  maxTokens: number;
}

/**
 * Predefined model configurations
 */
export const PREDEFINED_MODELS: Record<string, ModelConfig> = {
  // OpenAI
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    name: "GPT-4o",
    supportsStreaming: true,
    maxTokens: 128000,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    name: "GPT-4o Mini",
    supportsStreaming: true,
    maxTokens: 128000,
  },
  "gpt-4-turbo": {
    id: "gpt-4-turbo",
    provider: "openai",
    name: "GPT-4 Turbo",
    supportsStreaming: true,
    maxTokens: 128000,
  },
  "gpt-3.5-turbo": {
    id: "gpt-3.5-turbo",
    provider: "openai",
    name: "GPT-3.5 Turbo",
    supportsStreaming: true,
    maxTokens: 16385,
  },
  // Anthropic
  "claude-3-5-sonnet": {
    id: "claude-3-5-sonnet",
    provider: "anthropic",
    name: "Claude 3.5 Sonnet",
    supportsStreaming: true,
    maxTokens: 200000,
  },
  "claude-3-opus": {
    id: "claude-3-opus",
    provider: "anthropic",
    name: "Claude 3 Opus",
    supportsStreaming: true,
    maxTokens: 200000,
  },
  "claude-3-sonnet": {
    id: "claude-3-sonnet",
    provider: "anthropic",
    name: "Claude 3 Sonnet",
    supportsStreaming: true,
    maxTokens: 200000,
  },
  "claude-3-haiku": {
    id: "claude-3-haiku",
    provider: "anthropic",
    name: "Claude 3 Haiku",
    supportsStreaming: true,
    maxTokens: 200000,
  },
};

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return PREDEFINED_MODELS[modelId];
}

export function getProviderForModel(modelId: string): ModelProvider | undefined {
  return PREDEFINED_MODELS[modelId]?.provider;
}
