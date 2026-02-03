/**
 * LLM Service Layer - Public API
 */

// Re-export types
export type {
  MessageRole,
  ChatMessage,
  LLMRequestOptions,
  LLMResponse,
  LLMError as LLMErrorType,
  RetryConfig,
  RateLimitConfig,
  ModelConfig,
  ModelProvider,
} from "./types";

export {
  PREDEFINED_MODELS,
  getModelConfig,
  getProviderForModel,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_RATE_LIMIT,
} from "./types";

// Re-export OpenAI client
export { OpenAIClient, getOpenAIClient, resetOpenAIClient } from "./openai";

// Re-export Anthropic client
export { AnthropicClient, getAnthropicClient, resetAnthropicClient } from "./anthropic";

// Re-export OpenRouter client
export { OpenRouterClient, getOpenRouterClient, resetOpenRouterClient } from "./openrouter";

// Re-export Custom client
export {
  CustomAPIClient,
  registerCustomClient,
  getCustomClient,
  unregisterCustomClient,
  listCustomClients,
  type CustomEndpointConfig,
} from "./custom";

// Re-export Evaluator
export {
  evaluateOutput,
  evaluateOutputs,
  simpleTextComparison,
  getCategoryMetrics,
  type MetricEvaluation,
  type CategoryEvaluation,
  type EvaluationResult,
  type EvaluationRequest,
} from "./evaluator";

/**
 * Unified LLM client interface
 * Automatically selects the correct client based on model ID
 */
import { getProviderForModel } from "./types";
import { getOpenAIClient } from "./openai";
import { getAnthropicClient } from "./anthropic";
import { getOpenRouterClient } from "./openrouter";
import { getCustomClient } from "./custom";
import type { ChatMessage, LLMRequestOptions, LLMResponse } from "./types";
import { LLMError } from "../errors";

/**
 * Get the appropriate client for a model
 */
function getClientForModel(modelId: string, apiKey?: Record<string, string>) {
  const provider = getProviderForModel(modelId);

  switch (provider) {
    case "openai":
      return getOpenAIClient(apiKey?.openai);
    case "anthropic":
      return getAnthropicClient(apiKey?.anthropic);
    case "openrouter":
      return getOpenRouterClient(apiKey?.openrouter);
    case "custom":
      const client = getCustomClient(modelId);
      if (!client) {
        throw new LLMError("LLM", `No custom client found for model: ${modelId}`);
      }
      return client;
    default:
      throw new LLMError("LLM", `Unknown model: ${modelId}`);
  }
}

/**
 * Unified chat completion function
 */
export async function chat(
  modelId: string,
  messages: ChatMessage[],
  options?: LLMRequestOptions,
  apiKeys?: Record<string, string>
): Promise<LLMResponse> {
  const client = getClientForModel(modelId, apiKeys);
  return client.chat(modelId, messages, options);
}
