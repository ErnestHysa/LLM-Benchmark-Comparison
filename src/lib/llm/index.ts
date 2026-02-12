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
import { PREDEFINED_MODELS } from "./types";
import { getOpenAIClient } from "./openai";
import { getAnthropicClient } from "./anthropic";
import { getOpenRouterClient } from "./openrouter";
import { getCustomClient } from "./custom";
import type { ChatMessage, LLMRequestOptions, LLMResponse, ModelProvider } from "./types";
import { LLMError } from "../errors";
import { prisma } from "@/lib/prisma";

/**
 * Get provider for model - async version that also checks database for custom models
 */
export async function getProviderForModelAsync(
  modelId: string
): Promise<ModelProvider | undefined> {
  // First check predefined models (sync)
  const predefined = PREDEFINED_MODELS[modelId];
  if (predefined) {
    console.info("[LLM Service] Model found in PREDEFINED_MODELS:", {
      modelId,
      provider: predefined.provider,
    });
    return predefined.provider;
  }

  // Check OpenRouter format
  if (modelId.includes("/")) {
    console.info("[LLM Service] Detected OpenRouter model from format:", {
      modelId,
      provider: "openrouter",
    });
    return "openrouter";
  }

  // Check custom models in database
  if (modelId.startsWith("model-")) {
    try {
      const customModel = await prisma.model.findUnique({
        where: { id: modelId },
        select: { provider: true, providerId: true },
      });

      if (customModel) {
        console.info("[LLM Service] Found custom model in database:", {
          modelId,
          provider: customModel.provider,
          providerId: customModel.providerId,
        });

        // If providerId contains "/", it's actually an OpenRouter model
        // (user may have selected "Custom" but provided an OpenRouter endpoint)
        if (customModel.providerId && customModel.providerId.includes("/")) {
          console.info("[LLM Service] Detected OpenRouter model from providerId:", {
            modelId,
            providerId: customModel.providerId,
            provider: "openrouter",
          });
          return "openrouter";
        }

        // Map database provider to our provider type
        const providerMap: Record<string, ModelProvider> = {
          OPENAI: "openai",
          ANTHROPIC: "anthropic",
          OPENROUTER: "openrouter",
          CUSTOM: "custom",
        };

        return providerMap[customModel.provider] || "custom";
      }
    } catch (error) {
      console.error("[LLM Service] Error looking up custom model:", {
        modelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Model not recognized
  console.warn("[LLM Service] Model not recognized, provider unknown:", {
    modelId,
    checkedIn: "PREDEFINED_MODELS and database",
  });
  return undefined;
}

/**
 * Get the appropriate client for a model (async version for custom models)
 */
async function getClientForModelAsync(modelId: string, apiKeys?: Record<string, string>) {
  const provider = await getProviderForModelAsync(modelId);

  switch (provider) {
    case "openai":
      return getOpenAIClient(apiKeys?.OPENAI);
    case "anthropic":
      return getAnthropicClient(apiKeys?.ANTHROPIC);
    case "openrouter":
      return getOpenRouterClient(apiKeys?.OPENROUTER);
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
  console.info("[LLM chat] Starting chat request:", {
    modelId,
    messageCount: messages.length,
    hasOptions: !!options,
    hasApiKeys: !!apiKeys,
    apiKeyProviders: apiKeys ? Object.keys(apiKeys) : [],
  });

  const provider = await getProviderForModelAsync(modelId);
  console.info("[LLM chat] Determined provider for model:", {
    modelId,
    provider: provider || "unknown",
  });

  // Validate API key for provider
  // Note: provider is lowercase (e.g., "openai") but apiKeys uses uppercase keys (e.g., "OPENAI")
  if (provider && provider !== "custom") {
    const apiKey = apiKeys?.[provider.toUpperCase()];
    if (!apiKey || apiKey.length < 10) {
      throw new LLMError(
        "API_KEY",
        `Invalid or missing API key for provider: ${provider}. Please add a valid API key in Settings.`
      );
    }
  }

  const client = await getClientForModelAsync(modelId, apiKeys);
  const response = await client.chat(modelId, messages, options);

  console.info("[LLM chat] Chat response received:", {
    modelId,
    contentLength: response.content?.length || 0,
    tokensUsed: response.tokensUsed,
  });

  return response;
}
